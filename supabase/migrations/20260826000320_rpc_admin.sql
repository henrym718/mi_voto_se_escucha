-- ============================================================================
-- RPC del panel. Todas verifican el rol dentro de la función: el candidato
-- tiene rol de solo lectura y no puede llegar a las de escritura ni por error.
--
-- El embudo del equipo es corto a propósito: la cola muestra el borrador que
-- la IA armó a partir del audio, con el audio al lado por si hay dudas y con
-- los pedidos parecidos ya detectados. Revisar es leer, ajustar una palabra y
-- tocar Publicar — o tocar Unificar y sumarle el apoyo a la causa que ya existe.
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
-- Mueve la obra y deja la entrada en su línea de tiempo, en una transacción.
-- Ya no manda ningún WhatsApp: el vecino ve el avance en la misma página que
-- compartió, y lo colectivo se cuenta en el canal del sector.
create or replace function public.admin_obra_cambiar_estado(
  p_obra_id   uuid,
  p_estado_id uuid,
  p_texto     text default '',
  p_media     jsonb default '[]'::jsonb
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

  perform public.anotar_bitacora(
    v_obra.ciudad_id, 'cambio_estado', 'obra', p_obra_id,
    jsonb_build_object('de', v_anterior, 'a', p_estado_id)
  );

  return jsonb_build_object(
    'success', true,
    'publicacion_id', v_pub_id,
    'estado', jsonb_build_object('id', v_estado.id, 'nombre', v_estado.nombre, 'color', v_estado.color)
  );
end;
$$;

comment on function public.admin_obra_cambiar_estado is 'Mueve la obra y publica la entrada de la línea de tiempo, en una transacción.';

-- ------------------------------------------------- cola de aprobación --
-- Todo lo que el equipo necesita para decidir en un vistazo: el borrador de la
-- IA, lo que el vecino dijo de verdad, el audio, y las causas ya publicadas
-- que se le parecen.
--
-- El parecido se calcula con trigram, la misma pieza que ya mueve el buscador.
-- Compara el título propuesto contra los títulos aprobados del mismo sector,
-- que es donde de verdad se repiten: diez vecinos de un barrio reportando que
-- no hay agua deben terminar en UNA causa con diez apoyos, no en diez causas
-- con uno.
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
             'texto_original', o.texto_original,
             'transcripcion', o.transcripcion,
             'audio_url', o.audio_url,
             'foto_url', o.foto_url,
             'ia_estado', o.ia_estado,
             'creada_en', o.creada_en,
             'ciudadela', cd.nombre,
             'ciudadela_id', o.ciudadela_id,
             'categoria', ct.nombre,
             'categoria_id', o.categoria_id,
             'parecidas', public.admin_obras_parecidas(o.id)
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

-- ------------------------------------------------- admin_obras_parecidas --
-- Las tres causas aprobadas del sector que más se parecen a un pedido. Si el
-- texto todavía no pasó por la IA se compara contra lo que el vecino dijo.
create or replace function public.admin_obras_parecidas(p_obra_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_obra  public.obras;
  v_texto text;
  v_items jsonb;
begin
  select * into v_obra from public.obras where id = p_obra_id;
  if v_obra.id is null then
    return '[]'::jsonb;
  end if;

  v_texto := public.fn_search_norm(
    coalesce(nullif(trim(coalesce(v_obra.titulo, '')), ''),
             v_obra.transcripcion,
             v_obra.texto_original, '')
  );
  if length(v_texto) < 6 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(fila order by -parecido), '[]'::jsonb)
    into v_items
    from (
      select jsonb_build_object(
               'id', o.id,
               'titulo', o.titulo,
               'apoyos', o.apoyos,
               'categoria', ct.nombre,
               'parecido', round(greatest(
                 word_similarity(v_texto, public.fn_search_norm(o.titulo)),
                 word_similarity(public.fn_search_norm(o.titulo), v_texto)
               )::numeric * 100)
             ) as fila,
             greatest(
               word_similarity(v_texto, public.fn_search_norm(o.titulo)),
               word_similarity(public.fn_search_norm(o.titulo), v_texto)
             ) as parecido
        from public.obras o
        join public.categorias ct on ct.id = o.categoria_id
       where o.ciudadela_id = v_obra.ciudadela_id
         and o.id <> v_obra.id
         and o.aprobada and o.fusionada_en is null and o.rechazada_en is null
       order by parecido desc
       limit 3
    ) t
   where parecido >= 0.3;

  return v_items;
end;
$$;

comment on function public.admin_obras_parecidas is 'Candidatas a unificar. Trigram sobre el título, dentro del mismo sector.';

-- --------------------------------------------------------- aprobar / rechazar --
-- Aprobar publica el texto que el equipo tiene delante: si ajustó una palabra
-- del borrador de la IA, se guarda ese ajuste en el mismo acto. Un solo viaje.
create or replace function public.admin_obra_aprobar(
  p_obra_id      uuid,
  p_titulo       text default null,
  p_descripcion  text default null,
  p_categoria_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obra   public.obras;
  v_titulo text;
begin
  select * into v_obra from public.obras where id = p_obra_id;
  if v_obra.id is null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_encontrada');
  end if;
  if not public.puede_editar(v_obra.ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  v_titulo := nullif(trim(coalesce(p_titulo, v_obra.titulo, '')), '');
  if v_titulo is null or length(v_titulo) < 8 then
    return jsonb_build_object('success', false, 'error_code', 'titulo_requerido');
  end if;

  if p_categoria_id is not null and not exists (
    select 1 from public.categorias ct
     where ct.id = p_categoria_id and ct.ciudad_id = v_obra.ciudad_id and ct.activa
  ) then
    return jsonb_build_object('success', false, 'error_code', 'categoria_invalida');
  end if;

  update public.obras
     set titulo       = left(v_titulo, 120),
         descripcion  = left(coalesce(trim(p_descripcion), descripcion), 1000),
         categoria_id = coalesce(p_categoria_id, categoria_id),
         ia_estado    = case when ia_estado = 'pendiente' then 'listo' else ia_estado end,
         aprobada     = true,
         aprobada_en  = now(),
         aprobada_por = auth.uid(),
         rechazada_en = null,
         motivo_rechazo = null
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
-- Une pedidos duplicados en una sola causa sumando los apoyos. Los votos que
-- ya existían en el destino no se duplican gracias al índice único. Sirve tanto
-- para dos causas publicadas como para mandar un pedido de la cola a la causa
-- que ya lo representa: el vecino que lo pidió termina apoyando esa.
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
             activo          = coalesce((v_item ->> 'activo')::boolean, true)
       where id = v_id and ciudad_id = p_ciudad_id;
    else
      insert into public.estados (
        ciudad_id, nombre, slug, descripcion, color, orden,
        es_inicial, es_compromiso, es_cierre_suave
      ) values (
        p_ciudad_id,
        v_item ->> 'nombre',
        coalesce(nullif(v_item ->> 'slug', ''), public.slugificar(v_item ->> 'nombre')),
        coalesce(v_item ->> 'descripcion', ''),
        coalesce(v_item ->> 'color', '#8b8993'),
        coalesce((v_item ->> 'orden')::integer, 0),
        coalesce((v_item ->> 'es_inicial')::boolean, false),
        coalesce((v_item ->> 'es_compromiso')::boolean, false),
        coalesce((v_item ->> 'es_cierre_suave')::boolean, false)
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
-- El tablero que se le vende al candidato: demanda por sector.
--
-- El porcentaje se calcula solo con los apoyos de gente que declaró vivir en
-- ese sector. Es más estricto que el total y por eso es el que sirve para
-- decidir: una causa puede sumar apoyos de todo el cantón, pero lo que dice
-- cuánto le duele al barrio son los apoyos del barrio.
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
                            'apoyos_locales', o.locales,
                            'porcentaje',
                              case when public.vecinos_en_ciudadela(cd.id) > 0
                                   then round((o.locales::numeric / public.vecinos_en_ciudadela(cd.id)) * 100, 1)
                                   else 0 end,
                            'categoria', ct.nombre,
                            'estado', e.nombre,
                            'estado_color', e.color
                          ) order by o.apoyos desc
                        ), '[]'::jsonb)
                   from (
                     select o2.*,
                            (select count(*) from public.votos v
                               join public.vecinos ve on ve.id = v.vecino_id
                              where v.obra_id = o2.id and ve.ciudadela_id = cd.id) as locales
                       from public.obras o2
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
      'contactos', (select count(*) from public.vecinos where ciudad_id = p_ciudad_id and telefono is not null),
      'obras',   (select count(*) from public.obras where ciudad_id = p_ciudad_id and aprobada and fusionada_en is null),
      'apoyos',  (select coalesce(sum(apoyos), 0) from public.obras where ciudad_id = p_ciudad_id and aprobada and fusionada_en is null),
      'en_cola', (select count(*) from public.obras where ciudad_id = p_ciudad_id and not aprobada and rechazada_en is null)
    )
  );
end;
$$;

comment on function public.admin_ranking is 'Demanda por sector y por categoría. El porcentaje usa solo apoyos locales.';
