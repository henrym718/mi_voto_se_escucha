-- ============================================================================
-- El catálogo del cantón, editable desde el panel.
--
-- Los sectores y las categorías se sembraron a mano al montar cada ciudad, y
-- hasta aquí solo se podían tocar entrando a la base de datos. Eso convierte
-- una tarea de campo —«falta la ciudadela Los Ceibos», «la lotización nueva se
-- llama distinto»— en un ticket para el equipo técnico, y en campaña eso no
-- escala: quien camina el barrio es quien descubre que falta un sector.
--
-- Las tablas ya dejaban escribir al equipo (política «el equipo gestiona sus
-- ciudadelas»); lo que faltaba era la puerta con validación, bitácora y el
-- mismo trato que reciben los estados: nada se borra, se desactiva.
--
-- Por qué nunca se borra: hay obras, votos y fichas de vecinos apuntando a un
-- sector. Borrarlo dejaría obras huérfanas y perdería el padrón del barrio.
-- Desactivarlo lo saca del selector del vecino y deja el historial en pie.
-- ============================================================================

-- ---------------------------------------------------- admin_catalogo_listar --
-- Sectores y categorías de la ciudad, incluidos los desactivados: el panel
-- necesita verlos para poder revivirlos, y el vecino nunca ve esta lista.
--
-- Cada fila viene con cuánto cuelga de ella. Sin ese número, desactivar un
-- sector es a ciegas: nadie sabe si está apagando algo con 40 obras y 300
-- vecinos detrás o una lotización que se creó por error hace una semana.
create or replace function public.admin_catalogo_listar(p_ciudad_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ciudadelas jsonb;
  v_categorias jsonb;
begin
  if not public.es_del_equipo(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', cd.id,
             'nombre', cd.nombre,
             'slug', cd.slug,
             'zona', cd.zona,
             'verificado', cd.verificado,
             'fuente', cd.fuente,
             'poblacion_estimada', cd.poblacion_estimada,
             'enlace_canal', cd.enlace_canal,
             'orden', cd.orden,
             'activa', cd.activa,
             'obras', (select count(*) from public.obras o where o.ciudadela_id = cd.id),
             'vecinos', (select count(*) from public.vecinos v where v.ciudadela_id = cd.id)
           ) order by cd.activa desc, cd.orden, cd.nombre
         ), '[]'::jsonb)
    into v_ciudadelas
    from public.ciudadelas cd
   where cd.ciudad_id = p_ciudad_id;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', ct.id,
             'nombre', ct.nombre,
             'slug', ct.slug,
             'icono', ct.icono,
             'color', ct.color,
             'orden', ct.orden,
             'activa', ct.activa,
             'obras', (select count(*) from public.obras o where o.categoria_id = ct.id)
           ) order by ct.activa desc, ct.orden, ct.nombre
         ), '[]'::jsonb)
    into v_categorias
    from public.categorias ct
   where ct.ciudad_id = p_ciudad_id;

  return jsonb_build_object(
    'success', true,
    'ciudadelas', v_ciudadelas,
    'categorias', v_categorias
  );
end;
$$;

comment on function public.admin_catalogo_listar is 'Sectores y categorías con lo que cuelga de cada uno, activos y desactivados.';

-- ------------------------------------------------- admin_ciudadelas_guardar --
-- Recibe la lista completa de sectores activos, igual que admin_estados_guardar.
-- Lo que no viene se desactiva; lo que viene con id se actualiza; lo nuevo se
-- inserta, y si el slug ya existía desactivado, revive.
create or replace function public.admin_ciudadelas_guardar(
  p_ciudad_id  uuid,
  p_ciudadelas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item   jsonb;
  v_ids    uuid[] := '{}';
  v_id     uuid;
  v_nombre text;
  v_slug   text;
  v_zona   text;
  v_enlace text;
  v_pobl   integer;
  v_slugs  text[] := '{}';
  v_orden  integer := 0;
begin
  if not public.puede_editar(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  -- Un cantón sin un solo sector activo deja al vecino sin nada que elegir al
  -- publicar: la pantalla se queda en blanco y el pedido no puede entrar.
  if jsonb_array_length(coalesce(p_ciudadelas, '[]'::jsonb)) = 0 then
    return jsonb_build_object('success', false, 'error_code', 'sin_sectores');
  end if;

  -- Primera pasada: validar el lote entero antes de escribir nada. Guardar la
  -- mitad y fallar en la otra dejaría el catálogo en un estado que el equipo
  -- no pidió y que la pantalla ya no refleja.
  for v_item in select * from jsonb_array_elements(p_ciudadelas) loop
    v_nombre := trim(coalesce(v_item ->> 'nombre', ''));
    if length(v_nombre) < 3 then
      return jsonb_build_object('success', false, 'error_code', 'nombre_muy_corto',
                                'detalle', v_nombre);
    end if;

    v_zona := coalesce(nullif(v_item ->> 'zona', ''), 'urbana');
    if v_zona not in ('urbana', 'rural', 'funcional') then
      return jsonb_build_object('success', false, 'error_code', 'zona_invalida',
                                'detalle', v_nombre);
    end if;

    -- El mismo enlace mal pegado que ya vigila admin_canales_guardar: desde la
    -- pantalla de éxito manda al vecino a cualquier parte.
    v_enlace := nullif(trim(coalesce(v_item ->> 'enlace_canal', '')), '');
    if v_enlace is not null
       and v_enlace !~* '^https://(chat\.whatsapp\.com|whatsapp\.com/channel)/' then
      return jsonb_build_object('success', false, 'error_code', 'enlace_invalido',
                                'detalle', v_nombre);
    end if;

    -- Dos sectores con el mismo nombre chocan contra el índice único al llegar
    -- al insert. Se avisa con el nombre delante en vez de reventar con un error
    -- de Postgres que nadie sabe leer.
    v_slug := coalesce(nullif(v_item ->> 'slug', ''), public.slugificar(v_nombre));
    if v_slug = any (v_slugs) then
      return jsonb_build_object('success', false, 'error_code', 'sector_repetido',
                                'detalle', v_nombre);
    end if;
    v_slugs := array_append(v_slugs, v_slug);
  end loop;

  -- Segunda pasada: escribir.
  for v_item in select * from jsonb_array_elements(p_ciudadelas) loop
    v_nombre := trim(v_item ->> 'nombre');
    v_slug   := coalesce(nullif(v_item ->> 'slug', ''), public.slugificar(v_nombre));
    v_zona   := coalesce(nullif(v_item ->> 'zona', ''), 'urbana');
    v_enlace := nullif(trim(coalesce(v_item ->> 'enlace_canal', '')), '');
    v_pobl   := nullif(v_item ->> 'poblacion_estimada', '')::integer;
    v_orden  := v_orden + 1;

    if (v_item ->> 'id') is not null and (v_item ->> 'id') <> '' then
      -- El slug NO se toca al renombrar: es por lo que el vecino filtra obras
      -- y hay enlaces circulando por WhatsApp con él dentro.
      v_id := (v_item ->> 'id')::uuid;
      update public.ciudadelas
         set nombre             = v_nombre,
             zona               = v_zona,
             verificado         = coalesce((v_item ->> 'verificado')::boolean, false),
             fuente             = nullif(trim(coalesce(v_item ->> 'fuente', '')), ''),
             poblacion_estimada = v_pobl,
             enlace_canal       = v_enlace,
             orden              = v_orden,
             activa             = true
       where id = v_id and ciudad_id = p_ciudad_id;

      if not found then
        return jsonb_build_object('success', false, 'error_code', 'sector_invalido',
                                  'detalle', v_nombre);
      end if;
    else
      insert into public.ciudadelas (
        ciudad_id, nombre, slug, zona, verificado, fuente,
        poblacion_estimada, enlace_canal, orden
      ) values (
        p_ciudad_id, v_nombre, v_slug, v_zona,
        coalesce((v_item ->> 'verificado')::boolean, false),
        nullif(trim(coalesce(v_item ->> 'fuente', '')), ''),
        v_pobl, v_enlace, v_orden
      )
      -- Un sector que se quitó antes sigue existiendo desactivado, con sus
      -- obras y sus vecinos colgando. Volver a escribir el mismo nombre lo
      -- revive en lugar de reventar por slug duplicado.
      on conflict (ciudad_id, slug) do update
        set nombre             = excluded.nombre,
            zona               = excluded.zona,
            verificado         = excluded.verificado,
            fuente             = excluded.fuente,
            poblacion_estimada = excluded.poblacion_estimada,
            enlace_canal       = excluded.enlace_canal,
            orden              = excluded.orden,
            activa             = true
      returning id into v_id;
    end if;

    v_ids := array_append(v_ids, v_id);
  end loop;

  update public.ciudadelas
     set activa = false
   where ciudad_id = p_ciudad_id and not (id = any (v_ids));

  perform public.anotar_bitacora(p_ciudad_id, 'guardar_ciudadelas', 'ciudadelas', null,
                                 jsonb_build_object('activos', array_length(v_ids, 1)));

  return jsonb_build_object('success', true, 'ids', to_jsonb(v_ids));
end;
$$;

comment on function public.admin_ciudadelas_guardar is 'Lista completa de sectores activos. Lo que no viene se desactiva, nunca se borra.';

-- ------------------------------------------------- admin_categorias_guardar --
create or replace function public.admin_categorias_guardar(
  p_ciudad_id  uuid,
  p_categorias jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item   jsonb;
  v_ids    uuid[] := '{}';
  v_id     uuid;
  v_nombre text;
  v_slug   text;
  v_slugs  text[] := '{}';
  v_orden  integer := 0;
begin
  if not public.puede_editar(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  -- Sin categorías no hay dónde clasificar un pedido: obra_crear y
  -- admin_obra_crear rechazan toda alta con 'categoria_invalida'.
  if jsonb_array_length(coalesce(p_categorias, '[]'::jsonb)) = 0 then
    return jsonb_build_object('success', false, 'error_code', 'sin_categorias');
  end if;

  for v_item in select * from jsonb_array_elements(p_categorias) loop
    v_nombre := trim(coalesce(v_item ->> 'nombre', ''));
    if length(v_nombre) < 3 then
      return jsonb_build_object('success', false, 'error_code', 'nombre_muy_corto',
                                'detalle', v_nombre);
    end if;

    v_slug := coalesce(nullif(v_item ->> 'slug', ''), public.slugificar(v_nombre));
    if v_slug = any (v_slugs) then
      return jsonb_build_object('success', false, 'error_code', 'categoria_repetida',
                                'detalle', v_nombre);
    end if;
    v_slugs := array_append(v_slugs, v_slug);
  end loop;

  for v_item in select * from jsonb_array_elements(p_categorias) loop
    v_nombre := trim(v_item ->> 'nombre');
    v_slug   := coalesce(nullif(v_item ->> 'slug', ''), public.slugificar(v_nombre));
    v_orden  := v_orden + 1;

    if (v_item ->> 'id') is not null and (v_item ->> 'id') <> '' then
      v_id := (v_item ->> 'id')::uuid;
      update public.categorias
         set nombre = v_nombre,
             icono  = coalesce(nullif(v_item ->> 'icono', ''), 'wrench'),
             color  = coalesce(nullif(v_item ->> 'color', ''), '#0d7d6c'),
             orden  = v_orden,
             activa = true
       where id = v_id and ciudad_id = p_ciudad_id;

      if not found then
        return jsonb_build_object('success', false, 'error_code', 'categoria_invalida',
                                  'detalle', v_nombre);
      end if;
    else
      insert into public.categorias (ciudad_id, nombre, slug, icono, color, orden)
      values (
        p_ciudad_id, v_nombre, v_slug,
        coalesce(nullif(v_item ->> 'icono', ''), 'wrench'),
        coalesce(nullif(v_item ->> 'color', ''), '#0d7d6c'),
        v_orden
      )
      on conflict (ciudad_id, slug) do update
        set nombre = excluded.nombre,
            icono  = excluded.icono,
            color  = excluded.color,
            orden  = excluded.orden,
            activa = true
      returning id into v_id;
    end if;

    v_ids := array_append(v_ids, v_id);
  end loop;

  update public.categorias
     set activa = false
   where ciudad_id = p_ciudad_id and not (id = any (v_ids));

  perform public.anotar_bitacora(p_ciudad_id, 'guardar_categorias', 'categorias', null,
                                 jsonb_build_object('activas', array_length(v_ids, 1)));

  return jsonb_build_object('success', true, 'ids', to_jsonb(v_ids));
end;
$$;

comment on function public.admin_categorias_guardar is 'Lista completa de categorías activas. Lo que no viene se desactiva.';

-- ============================================================================
-- Permisos
-- ============================================================================

grant execute on function public.admin_catalogo_listar(uuid)           to authenticated;
grant execute on function public.admin_ciudadelas_guardar(uuid, jsonb) to authenticated;
grant execute on function public.admin_categorias_guardar(uuid, jsonb) to authenticated;

-- Toda RPC admin_* nace con EXECUTE para PUBLIC. Se cierran como las demás.
select public.cerrar_funciones_admin();
