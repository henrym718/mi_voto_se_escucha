-- ============================================================================
-- RPC del panel. Todas verifican el rol dentro de la función: el candidato
-- tiene rol de solo lectura y no puede llegar a las de escritura ni por error.
--
-- Un cambio de estado hace tres cosas de una vez y en la misma transacción:
-- mueve la obra, publica la entrada en la línea de tiempo, y encola el aviso
-- de WhatsApp para quienes la apoyaron. Si algo falla, no queda a medias.
-- ============================================================================

-- ---------------------------------------------------------- admin_tablero --
-- Datos del kanban: los estados como columnas y sus obras como tarjetas.
create or replace function public.admin_tablero(
  p_ciudad_id    uuid,
  p_ciudadela_id uuid default null,
  p_categoria_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_columnas jsonb;
begin
  if not public.es_del_equipo(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  select coalesce(jsonb_agg(col order by orden), '[]'::jsonb)
    into v_columnas
    from (
      select e.orden,
             jsonb_build_object(
               'id', e.id,
               'nombre', e.nombre,
               'slug', e.slug,
               'descripcion', e.descripcion,
               'color', e.color,
               'orden', e.orden,
               'es_compromiso', e.es_compromiso,
               'es_cierre_suave', e.es_cierre_suave,
               'notifica', e.notifica,
               'total', (
                 select count(*) from public.obras o
                  where o.estado_id = e.id and o.aprobada and o.fusionada_en is null
                    and (p_ciudadela_id is null or o.ciudadela_id = p_ciudadela_id)
                    and (p_categoria_id is null or o.categoria_id = p_categoria_id)
               ),
               'obras', (
                 select coalesce(jsonb_agg(
                          jsonb_build_object(
                            'id', o.id,
                            'codigo', o.codigo,
                            'titulo', o.titulo,
                            'apoyos', o.apoyos,
                            'porcentaje_ciudadela',
                              case when public.vecinos_en_ciudadela(o.ciudadela_id) > 0
                                   then round((o.apoyos::numeric / public.vecinos_en_ciudadela(o.ciudadela_id)) * 100, 1)
                                   else 0 end,
                            'ciudadela', cd.nombre,
                            'categoria', ct.nombre,
                            'categoria_icono', ct.icono,
                            'dias_sin_cambio', extract(day from now() - o.actualizada_en)::integer,
                            'tiene_media', exists (
                              select 1 from public.publicaciones p
                               where p.obra_id = o.id and jsonb_array_length(p.media) > 0
                            )
                          ) order by o.apoyos desc
                        ), '[]'::jsonb)
                   from public.obras o
                   join public.ciudadelas cd on cd.id = o.ciudadela_id
                   join public.categorias ct on ct.id = o.categoria_id
                  where o.estado_id = e.id and o.aprobada and o.fusionada_en is null
                    and (p_ciudadela_id is null or o.ciudadela_id = p_ciudadela_id)
                    and (p_categoria_id is null or o.categoria_id = p_categoria_id)
                  limit 50
               )
             ) as col
        from public.estados e
       where e.ciudad_id = p_ciudad_id and e.activo
       order by e.orden
    ) t;

  return jsonb_build_object('success', true, 'columnas', v_columnas);
end;
$$;

comment on function public.admin_tablero is 'Columnas del kanban = estados configurables de la ciudad.';

-- -------------------------------------------- admin_obra_cambiar_estado --
create or replace function public.admin_obra_cambiar_estado(
  p_obra_id   uuid,
  p_estado_id uuid,
  p_texto     text default '',
  p_media     jsonb default '[]'::jsonb,
  p_notificar boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obra      public.obras;
  v_estado    public.estados;
  v_anterior  uuid;
  v_encoladas integer := 0;
  v_pub_id    uuid;
begin
  select * into v_obra from public.obras where id = p_obra_id;
  if v_obra.id is null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_encontrada');
  end if;

  if not public.puede_editar(v_obra.ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  select * into v_estado from public.estados
   where id = p_estado_id and ciudad_id = v_obra.ciudad_id and activo;
  if v_estado.id is null then
    return jsonb_build_object('success', false, 'error_code', 'estado_invalido');
  end if;

  v_anterior := v_obra.estado_id;

  update public.obras set estado_id = p_estado_id where id = p_obra_id;

  insert into public.publicaciones (ciudad_id, obra_id, estado_id, estado_anterior_id, texto, media, autor_id)
  values (v_obra.ciudad_id, p_obra_id, p_estado_id, v_anterior, coalesce(trim(p_texto), ''),
          coalesce(p_media, '[]'::jsonb), auth.uid())
  returning id into v_pub_id;

  -- Aviso a quienes apoyaron. Es el momento en que el candidato cosecha el
  -- crédito exactamente ante las personas que pidieron la obra.
  if p_notificar and v_estado.notifica then
    insert into public.notificaciones (
      ciudad_id, vecino_id, telefono, plantilla, params, boton_path, origen_tipo, origen_id
    )
    select v_obra.ciudad_id,
           ve.id,
           ve.telefono,
           'obra_avance',
           jsonb_build_object(
             'obra', v_obra.titulo,
             'estado', v_estado.nombre,
             'ciudadela', (select nombre from public.ciudadelas where id = v_obra.ciudadela_id),
             'mensaje', left(coalesce(nullif(trim(p_texto), ''), v_estado.descripcion), 300)
           ),
           'o/' || v_obra.codigo,
           'obra',
           p_obra_id
      from public.votos vo
      join public.vecinos ve on ve.id = vo.vecino_id
     where vo.obra_id = p_obra_id
       and ve.consentimiento_notif
       and ve.baja_en is null;

    get diagnostics v_encoladas = row_count;
  end if;

  perform public.anotar_bitacora(
    v_obra.ciudad_id, 'cambio_estado', 'obra', p_obra_id,
    jsonb_build_object('de', v_anterior, 'a', p_estado_id, 'notificados', v_encoladas)
  );

  return jsonb_build_object(
    'success', true,
    'publicacion_id', v_pub_id,
    'notificados', v_encoladas,
    'estado', jsonb_build_object('id', v_estado.id, 'nombre', v_estado.nombre, 'color', v_estado.color)
  );
end;
$$;

comment on function public.admin_obra_cambiar_estado is 'Mueve la obra, publica la entrada y encola los avisos, todo en una transacción.';

-- ------------------------------------------------- cola de aprobación --
create or replace function public.admin_cola_aprobacion(p_ciudad_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  if not public.es_del_equipo(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', o.id,
             'titulo', o.titulo,
             'descripcion', o.descripcion,
             'foto_url', o.foto_url,
             'creada_en', o.creada_en,
             'ciudadela', cd.nombre,
             'ciudadela_id', o.ciudadela_id,
             'categoria', ct.nombre,
             'categoria_id', o.categoria_id,
             'similares', (
               select count(*) from public.obras o2
                where o2.ciudadela_id = o.ciudadela_id
                  and o2.categoria_id = o.categoria_id
                  and o2.aprobada and o2.fusionada_en is null and o2.id <> o.id
             )
           ) order by o.creada_en asc
         ), '[]'::jsonb)
    into v_items
    from public.obras o
    join public.ciudadelas cd on cd.id = o.ciudadela_id
    join public.categorias ct on ct.id = o.categoria_id
   where o.ciudad_id = p_ciudad_id
     and not o.aprobada
     and o.rechazada_en is null
     and o.fusionada_en is null;

  return jsonb_build_object('success', true, 'items', v_items);
end;
$$;

create or replace function public.admin_obra_aprobar(p_obra_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obra public.obras;
begin
  select * into v_obra from public.obras where id = p_obra_id;
  if v_obra.id is null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_encontrada');
  end if;
  if not public.puede_editar(v_obra.ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  update public.obras
     set aprobada = true, aprobada_en = now(), aprobada_por = auth.uid(),
         rechazada_en = null, motivo_rechazo = null
   where id = p_obra_id;

  perform public.anotar_bitacora(v_obra.ciudad_id, 'aprobar', 'obra', p_obra_id, '{}'::jsonb);

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_obra_rechazar(p_obra_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obra public.obras;
begin
  select * into v_obra from public.obras where id = p_obra_id;
  if v_obra.id is null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_encontrada');
  end if;
  if not public.puede_editar(v_obra.ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    return jsonb_build_object('success', false, 'error_code', 'motivo_requerido');
  end if;

  update public.obras
     set aprobada = false, rechazada_en = now(), motivo_rechazo = trim(p_motivo)
   where id = p_obra_id;

  perform public.anotar_bitacora(
    v_obra.ciudad_id, 'rechazar', 'obra', p_obra_id, jsonb_build_object('motivo', p_motivo)
  );

  return jsonb_build_object('success', true);
end;
$$;

-- --------------------------------------------------- admin_obras_fusionar --
-- Une pedidos duplicados en una sola obra sumando los apoyos. Los votos que
-- ya existían en el destino no se duplican gracias al índice único.
create or replace function public.admin_obras_fusionar(
  p_destino_id uuid,
  p_origen_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destino  public.obras;
  v_migrados integer := 0;
begin
  select * into v_destino from public.obras where id = p_destino_id;
  if v_destino.id is null then
    return jsonb_build_object('success', false, 'error_code', 'destino_no_encontrado');
  end if;
  if not public.puede_editar(v_destino.ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;
  if p_destino_id = any (p_origen_ids) then
    return jsonb_build_object('success', false, 'error_code', 'destino_en_origenes');
  end if;

  -- Los apoyos de las obras origen pasan al destino; los repetidos se ignoran.
  insert into public.votos (obra_id, vecino_id, ciudad_id)
  select p_destino_id, v.vecino_id, v_destino.ciudad_id
    from public.votos v
   where v.obra_id = any (p_origen_ids)
  on conflict (obra_id, vecino_id) do nothing;

  get diagnostics v_migrados = row_count;

  update public.obras
     set fusionada_en = p_destino_id
   where id = any (p_origen_ids)
     and ciudad_id = v_destino.ciudad_id;

  perform public.anotar_bitacora(
    v_destino.ciudad_id, 'fusionar', 'obra', p_destino_id,
    jsonb_build_object('origenes', p_origen_ids, 'apoyos_migrados', v_migrados)
  );

  return jsonb_build_object(
    'success', true,
    'apoyos_migrados', v_migrados,
    'apoyos_totales', (select apoyos from public.obras where id = p_destino_id)
  );
end;
$$;

-- ------------------------------------------------------- admin_estados --
-- Guarda la configuración de estados de la ciudad. Recibe el arreglo completo.
create or replace function public.admin_estados_guardar(
  p_ciudad_id uuid,
  p_estados   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item      jsonb;
  v_ids       uuid[] := '{}';
  v_id        uuid;
  v_iniciales integer := 0;
begin
  if not public.puede_editar(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  -- Exactamente un estado inicial, o el índice único lo rechazaría después.
  for v_item in select * from jsonb_array_elements(p_estados) loop
    if coalesce((v_item ->> 'es_inicial')::boolean, false) then
      v_iniciales := v_iniciales + 1;
    end if;
  end loop;
  if v_iniciales <> 1 then
    return jsonb_build_object('success', false, 'error_code', 'debe_haber_un_estado_inicial');
  end if;

  -- Se apaga el marcador de inicial en todos antes de reasignarlo, para no
  -- chocar con el índice único mientras se reordena.
  update public.estados set es_inicial = false where ciudad_id = p_ciudad_id;

  for v_item in select * from jsonb_array_elements(p_estados) loop
    if (v_item ->> 'id') is not null and (v_item ->> 'id') <> '' then
      v_id := (v_item ->> 'id')::uuid;
      update public.estados
         set nombre          = v_item ->> 'nombre',
             descripcion     = coalesce(v_item ->> 'descripcion', ''),
             color           = coalesce(v_item ->> 'color', '#8b8993'),
             orden           = coalesce((v_item ->> 'orden')::integer, 0),
             es_inicial      = coalesce((v_item ->> 'es_inicial')::boolean, false),
             es_compromiso   = coalesce((v_item ->> 'es_compromiso')::boolean, false),
             es_cierre_suave = coalesce((v_item ->> 'es_cierre_suave')::boolean, false),
             notifica        = coalesce((v_item ->> 'notifica')::boolean, true),
             activo          = coalesce((v_item ->> 'activo')::boolean, true)
       where id = v_id and ciudad_id = p_ciudad_id;
    else
      insert into public.estados (
        ciudad_id, nombre, slug, descripcion, color, orden,
        es_inicial, es_compromiso, es_cierre_suave, notifica
      ) values (
        p_ciudad_id,
        v_item ->> 'nombre',
        coalesce(nullif(v_item ->> 'slug', ''), public.slugificar(v_item ->> 'nombre')),
        coalesce(v_item ->> 'descripcion', ''),
        coalesce(v_item ->> 'color', '#8b8993'),
        coalesce((v_item ->> 'orden')::integer, 0),
        coalesce((v_item ->> 'es_inicial')::boolean, false),
        coalesce((v_item ->> 'es_compromiso')::boolean, false),
        coalesce((v_item ->> 'es_cierre_suave')::boolean, false),
        coalesce((v_item ->> 'notifica')::boolean, true)
      )
      -- Un estado que se quitó antes sigue existiendo desactivado, porque hay
      -- obras e historial apuntando a él. Si el equipo vuelve a añadir uno con
      -- el mismo nombre, se revive en lugar de reventar por slug duplicado.
      on conflict (ciudad_id, slug) do update
        set nombre          = excluded.nombre,
            descripcion     = excluded.descripcion,
            color           = excluded.color,
            orden           = excluded.orden,
            es_inicial      = excluded.es_inicial,
            es_compromiso   = excluded.es_compromiso,
            es_cierre_suave = excluded.es_cierre_suave,
            notifica        = excluded.notifica,
            activo          = true
      returning id into v_id;
    end if;
    v_ids := array_append(v_ids, v_id);
  end loop;

  -- Los que ya no vienen se desactivan; nunca se borran, porque hay obras
  -- e historial apuntando a ellos.
  update public.estados
     set activo = false
   where ciudad_id = p_ciudad_id and not (id = any (v_ids));

  perform public.anotar_bitacora(p_ciudad_id, 'guardar_estados', 'estados', null,
                                 jsonb_build_object('total', array_length(v_ids, 1)));

  return jsonb_build_object('success', true, 'ids', to_jsonb(v_ids));
end;
$$;

-- --------------------------------------------------------- admin_ranking --
-- El tablero que se le vende al candidato: demanda por ciudadela con el peso
-- real de cada obra sobre los vecinos verificados de ese barrio.
create or replace function public.admin_ranking(
  p_ciudad_id    uuid,
  p_categoria_id uuid default null
)
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

  select coalesce(jsonb_agg(fila order by vecinos desc nulls last), '[]'::jsonb)
    into v_ciudadelas
    from (
      select cd.id,
             public.vecinos_en_ciudadela(cd.id) as vecinos,
             jsonb_build_object(
               'id', cd.id,
               'nombre', cd.nombre,
               'verificado', cd.verificado,
               'vecinos', public.vecinos_en_ciudadela(cd.id),
               'obras', (
                 select count(*) from public.obras o
                  where o.ciudadela_id = cd.id and o.aprobada and o.fusionada_en is null
               ),
               'apoyos', (
                 select coalesce(sum(o.apoyos), 0) from public.obras o
                  where o.ciudadela_id = cd.id and o.aprobada and o.fusionada_en is null
               ),
               'top', (
                 select coalesce(jsonb_agg(
                          jsonb_build_object(
                            'id', o.id,
                            'titulo', o.titulo,
                            'apoyos', o.apoyos,
                            'porcentaje',
                              case when public.vecinos_en_ciudadela(cd.id) > 0
                                   then round((o.apoyos::numeric / public.vecinos_en_ciudadela(cd.id)) * 100, 1)
                                   else 0 end,
                            'categoria', ct.nombre,
                            'estado', e.nombre,
                            'estado_color', e.color
                          ) order by o.apoyos desc
                        ), '[]'::jsonb)
                   from (
                     select o2.* from public.obras o2
                      where o2.ciudadela_id = cd.id and o2.aprobada and o2.fusionada_en is null
                        and (p_categoria_id is null or o2.categoria_id = p_categoria_id)
                      order by o2.apoyos desc limit 5
                   ) o
                   join public.categorias ct on ct.id = o.categoria_id
                   join public.estados    e  on e.id  = o.estado_id
               )
             ) as fila
        from public.ciudadelas cd
       where cd.ciudad_id = p_ciudad_id and cd.activa
    ) t;

  -- Reparto de la demanda por categoría: el dato del guion de mitin.
  select coalesce(jsonb_agg(fila order by apoyos desc), '[]'::jsonb)
    into v_categorias
    from (
      select ct.id,
             coalesce(sum(o.apoyos), 0) as apoyos,
             jsonb_build_object(
               'id', ct.id,
               'nombre', ct.nombre,
               'icono', ct.icono,
               'obras', count(o.id),
               'apoyos', coalesce(sum(o.apoyos), 0)
             ) as fila
        from public.categorias ct
        left join public.obras o
          on o.categoria_id = ct.id and o.aprobada and o.fusionada_en is null
       where ct.ciudad_id = p_ciudad_id and ct.activa
       group by ct.id, ct.nombre, ct.icono
    ) t;

  return jsonb_build_object(
    'success', true,
    'ciudadelas', v_ciudadelas,
    'categorias', v_categorias,
    'totales', jsonb_build_object(
      'vecinos', (select count(*) from public.vecinos where ciudad_id = p_ciudad_id),
      'obras',   (select count(*) from public.obras where ciudad_id = p_ciudad_id and aprobada and fusionada_en is null),
      'apoyos',  (select coalesce(sum(apoyos), 0) from public.obras where ciudad_id = p_ciudad_id and aprobada and fusionada_en is null),
      'en_cola', (select count(*) from public.obras where ciudad_id = p_ciudad_id and not aprobada and rechazada_en is null)
    )
  );
end;
$$;

comment on function public.admin_ranking is 'Demanda por ciudadela y por categoría. El porcentaje corrige el sesgo de barrio grande.';
