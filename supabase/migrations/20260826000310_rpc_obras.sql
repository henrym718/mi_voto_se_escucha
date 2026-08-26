-- ============================================================================
-- RPC públicas del dominio: listar, ver, apoyar y publicar pedidos.
--
-- El apoyo tiene dos reglas que viven aquí y no en el cliente:
--   1. Un apoyo por vecino por obra (además del índice único que lo garantiza).
--   2. Se apoya SOLO en la ciudadela propia. Es lo que hace confiable el mapa
--      de demanda que se le vende al candidato.
-- ============================================================================

-- Cuántos vecinos verificados tiene una ciudadela. Base del porcentaje.
create or replace function public.vecinos_en_ciudadela(p_ciudadela_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.vecinos v where v.ciudadela_id = p_ciudadela_id;
$$;

-- ---------------------------------------------------------- obras_listar --
-- Orden: 'apoyos' | 'recientes' | 'movimiento'
create or replace function public.obras_listar(
  p_ciudad_slug  text,
  p_ciudadela_id uuid default null,
  p_categoria_id uuid default null,
  p_estado_id    uuid default null,
  p_busqueda     text default null,
  p_orden        text default 'apoyos',
  p_limite       integer default 20,
  p_desde        integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ciudad_id uuid;
  v_items     jsonb;
  v_total     integer;
  -- Buscador estilo Pronto: texto normalizado (sin tildes, minúsculas) y un
  -- puntaje por obra. «anibal» encuentra «Aníbal» y «lastre» tolera «laste».
  -- Con 1-2 letras solo vale el match directo: el trigram ahí es puro ruido.
  v_qn     text;
  v_umbral numeric;
begin
  select c.id into v_ciudad_id from public.ciudades c where c.slug = p_ciudad_slug and c.activa;
  if v_ciudad_id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudad_no_encontrada');
  end if;

  v_qn     := public.fn_search_norm(trim(coalesce(p_busqueda, '')));
  v_umbral := case when length(v_qn) <= 2 then 0.99 else 0.35 end;

  -- Puntaje por candidato (mismo esquema que el buscador de Pronto):
  --   · el título contiene el texto → 1.0; word_similarity tolera faltas
  --   · la ciudadela pesa 0.9 («anibal» encuentra las obras de Aníbal Zea)
  --   · la descripción solo por match directo, a 0.6
  -- Sin búsqueda, relevancia = 1.0: pasa el umbral y no altera el orden pedido.
  with base as (
    select o.*,
           cd.nombre as ciudadela_nombre,
           cd.slug   as ciudadela_slug,
           ct.nombre as categoria_nombre,
           ct.slug   as categoria_slug,
           ct.icono  as categoria_icono,
           e.nombre  as estado_nombre,
           e.slug    as estado_slug,
           e.color   as estado_color,
           public.vecinos_en_ciudadela(o.ciudadela_id) as vecinos_ciudadela,
           case when v_qn = '' then 1.0 else greatest(
             case when public.fn_search_norm(o.titulo) like '%' || v_qn || '%' then 1.0 else 0.0 end,
             word_similarity(v_qn, public.fn_search_norm(o.titulo)),
             0.9 * greatest(
               case when public.fn_search_norm(cd.nombre) like '%' || v_qn || '%' then 1.0 else 0.0 end,
               word_similarity(v_qn, public.fn_search_norm(cd.nombre))
             ),
             case when public.fn_search_norm(coalesce(o.descripcion, '')) like '%' || v_qn || '%' then 0.6 else 0.0 end
           ) end as relevancia
      from public.obras o
      join public.ciudadelas cd on cd.id = o.ciudadela_id
      join public.categorias ct on ct.id = o.categoria_id
      join public.estados    e  on e.id  = o.estado_id
     where o.ciudad_id = v_ciudad_id
       and o.aprobada
       and o.fusionada_en is null
       and o.rechazada_en is null
       and (p_ciudadela_id is null or o.ciudadela_id = p_ciudadela_id)
       and (p_categoria_id is null or o.categoria_id = p_categoria_id)
       and (p_estado_id    is null or o.estado_id    = p_estado_id)
  )
  select count(*)::integer into v_total from base where base.relevancia >= v_umbral;

  with base as (
    select o.*,
           cd.nombre as ciudadela_nombre,
           cd.slug   as ciudadela_slug,
           ct.nombre as categoria_nombre,
           ct.slug   as categoria_slug,
           ct.icono  as categoria_icono,
           e.nombre  as estado_nombre,
           e.slug    as estado_slug,
           e.color   as estado_color,
           public.vecinos_en_ciudadela(o.ciudadela_id) as vecinos_ciudadela,
           case when v_qn = '' then 1.0 else greatest(
             case when public.fn_search_norm(o.titulo) like '%' || v_qn || '%' then 1.0 else 0.0 end,
             word_similarity(v_qn, public.fn_search_norm(o.titulo)),
             0.9 * greatest(
               case when public.fn_search_norm(cd.nombre) like '%' || v_qn || '%' then 1.0 else 0.0 end,
               word_similarity(v_qn, public.fn_search_norm(cd.nombre))
             ),
             case when public.fn_search_norm(coalesce(o.descripcion, '')) like '%' || v_qn || '%' then 0.6 else 0.0 end
           ) end as relevancia
      from public.obras o
      join public.ciudadelas cd on cd.id = o.ciudadela_id
      join public.categorias ct on ct.id = o.categoria_id
      join public.estados    e  on e.id  = o.estado_id
     where o.ciudad_id = v_ciudad_id
       and o.aprobada
       and o.fusionada_en is null
       and o.rechazada_en is null
       and (p_ciudadela_id is null or o.ciudadela_id = p_ciudadela_id)
       and (p_categoria_id is null or o.categoria_id = p_categoria_id)
       and (p_estado_id    is null or o.estado_id    = p_estado_id)
  )
  -- Buscando, manda la relevancia; sin búsqueda es constante y decide p_orden.
  select coalesce(jsonb_agg(fila order by orden_relevancia, orden_apoyos, orden_reciente), '[]'::jsonb)
    into v_items
    from (
      select jsonb_build_object(
               'id', b.id,
               'codigo', b.codigo,
               'titulo', b.titulo,
               'descripcion', b.descripcion,
               'foto_url', b.foto_url,
               'apoyos', b.apoyos,
               'porcentaje_ciudadela',
                 case when b.vecinos_ciudadela > 0
                      then round((b.apoyos::numeric / b.vecinos_ciudadela) * 100, 1)
                      else 0 end,
               'origen', b.origen,
               'fuente', b.fuente,
               'creada_en', b.creada_en,
               'actualizada_en', b.actualizada_en,
               'ciudadela', jsonb_build_object('id', b.ciudadela_id, 'nombre', b.ciudadela_nombre, 'slug', b.ciudadela_slug),
               'categoria', jsonb_build_object('id', b.categoria_id, 'nombre', b.categoria_nombre, 'slug', b.categoria_slug, 'icono', b.categoria_icono),
               'estado', jsonb_build_object('id', b.estado_id, 'nombre', b.estado_nombre, 'slug', b.estado_slug, 'color', b.estado_color),
               'ya_apoyada', exists (select 1 from public.votos v where v.obra_id = b.id and v.vecino_id = auth.uid())
             ) as fila,
             -b.relevancia as orden_relevancia,
             case when p_orden = 'apoyos' then -b.apoyos else 0 end as orden_apoyos,
             case
               when p_orden = 'recientes'   then extract(epoch from now() - b.creada_en)
               when p_orden = 'movimiento'  then extract(epoch from now() - b.actualizada_en)
               else -b.apoyos
             end as orden_reciente
        from base b
       where b.relevancia >= v_umbral
       -- El order by va ANTES del limit/offset: sin él, la página 2 podría
       -- repetir obras de la página 1 (el orden de un scan no está garantizado).
       order by orden_relevancia, orden_apoyos, orden_reciente
       limit greatest(p_limite, 1)
      offset greatest(p_desde, 0)
    ) t;

  return jsonb_build_object('success', true, 'total', v_total, 'items', v_items);
end;
$$;

-- ---------------------------------------------------------- obra_detalle --
-- Acepta el id o el código corto del enlace compartido (/o/K3M9PX).
create or replace function public.obra_detalle(
  p_obra_id uuid default null,
  p_codigo  text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_obra   record;
  v_linea  jsonb;
  v_vecinos integer;
begin
  select o.*,
         cd.nombre as ciudadela_nombre, cd.slug as ciudadela_slug,
         ct.nombre as categoria_nombre, ct.slug as categoria_slug, ct.icono as categoria_icono,
         e.nombre  as estado_nombre,  e.slug as estado_slug, e.color as estado_color,
         e.es_compromiso, e.descripcion as estado_descripcion,
         c.slug as ciudad_slug, c.nombre as ciudad_nombre
    into v_obra
    from public.obras o
    join public.ciudadelas cd on cd.id = o.ciudadela_id
    join public.categorias ct on ct.id = o.categoria_id
    join public.estados    e  on e.id  = o.estado_id
    join public.ciudades   c  on c.id  = o.ciudad_id
   where (p_obra_id is not null and o.id = p_obra_id)
      or (p_codigo  is not null and o.codigo = upper(trim(p_codigo)));

  if v_obra.id is null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_encontrada');
  end if;

  -- Una obra fusionada redirige a su destino en vez de mostrar una página muerta.
  if v_obra.fusionada_en is not null then
    return jsonb_build_object('success', false, 'error_code', 'obra_fusionada', 'destino_id', v_obra.fusionada_en);
  end if;

  if not v_obra.aprobada and v_obra.creador_id is distinct from auth.uid()
     and not public.es_del_equipo(v_obra.ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_disponible');
  end if;

  v_vecinos := public.vecinos_en_ciudadela(v_obra.ciudadela_id);

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', p.id,
             'texto', p.texto,
             'media', p.media,
             'creada_en', p.creada_en,
             'estado', case when e.id is null then null else
                        jsonb_build_object('nombre', e.nombre, 'slug', e.slug, 'color', e.color) end
           ) order by p.creada_en desc
         ), '[]'::jsonb)
    into v_linea
    from public.publicaciones p
    left join public.estados e on e.id = p.estado_id
   where p.obra_id = v_obra.id;

  return jsonb_build_object(
    'success', true,
    'obra', jsonb_build_object(
      'id', v_obra.id,
      'codigo', v_obra.codigo,
      'titulo', v_obra.titulo,
      'descripcion', v_obra.descripcion,
      'foto_url', v_obra.foto_url,
      'apoyos', v_obra.apoyos,
      'porcentaje_ciudadela',
        case when v_vecinos > 0 then round((v_obra.apoyos::numeric / v_vecinos) * 100, 1) else 0 end,
      'vecinos_ciudadela', v_vecinos,
      'origen', v_obra.origen,
      'fuente', v_obra.fuente,
      'aprobada', v_obra.aprobada,
      'creada_en', v_obra.creada_en,
      'ciudad', jsonb_build_object('slug', v_obra.ciudad_slug, 'nombre', v_obra.ciudad_nombre),
      'ciudadela', jsonb_build_object('id', v_obra.ciudadela_id, 'nombre', v_obra.ciudadela_nombre, 'slug', v_obra.ciudadela_slug),
      'categoria', jsonb_build_object('id', v_obra.categoria_id, 'nombre', v_obra.categoria_nombre, 'slug', v_obra.categoria_slug, 'icono', v_obra.categoria_icono),
      'estado', jsonb_build_object('id', v_obra.estado_id, 'nombre', v_obra.estado_nombre, 'slug', v_obra.estado_slug,
                                   'color', v_obra.estado_color, 'descripcion', v_obra.estado_descripcion,
                                   'es_compromiso', v_obra.es_compromiso),
      'ya_apoyada', exists (select 1 from public.votos v where v.obra_id = v_obra.id and v.vecino_id = auth.uid()),
      'linea_tiempo', v_linea
    )
  );
end;
$$;

-- ----------------------------------------------------------- obra_apoyar --
create or replace function public.obra_apoyar(p_obra_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_vecino public.vecinos;
  v_obra   public.obras;
  v_pos    integer;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  select * into v_vecino from public.vecinos where id = v_uid;
  if v_vecino.id is null then
    return jsonb_build_object('success', false, 'error_code', 'vecino_no_registrado');
  end if;
  if v_vecino.ciudadela_id is null then
    return jsonb_build_object('success', false, 'error_code', 'falta_ciudadela');
  end if;

  select * into v_obra from public.obras where id = p_obra_id;
  if v_obra.id is null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_encontrada');
  end if;
  if not v_obra.aprobada or v_obra.fusionada_en is not null or v_obra.rechazada_en is not null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_disponible');
  end if;
  if v_obra.ciudad_id <> v_vecino.ciudad_id then
    return jsonb_build_object('success', false, 'error_code', 'otra_ciudad');
  end if;

  -- La regla que sostiene el valor del dato: se apoya solo en la ciudadela propia.
  if v_obra.ciudadela_id <> v_vecino.ciudadela_id then
    return jsonb_build_object('success', false, 'error_code', 'fuera_de_tu_ciudadela');
  end if;

  insert into public.votos (obra_id, vecino_id, ciudad_id)
  values (p_obra_id, v_uid, v_obra.ciudad_id)
  on conflict (obra_id, vecino_id) do nothing;

  update public.vecinos set ultimo_acceso_en = now() where id = v_uid;

  select count(*)::integer + 1 into v_pos
    from public.obras o
   where o.ciudadela_id = v_obra.ciudadela_id
     and o.aprobada and o.fusionada_en is null
     and o.apoyos > (select apoyos from public.obras where id = p_obra_id);

  return jsonb_build_object(
    'success', true,
    'apoyos', (select apoyos from public.obras where id = p_obra_id),
    'posicion_ciudadela', v_pos,
    'necesita_perfil', v_vecino.edad_rango is null
  );
end;
$$;

comment on function public.obra_apoyar is 'Un apoyo por vecino por obra, y solo en su propia ciudadela.';

-- ----------------------------------------------------- obra_quitar_apoyo --
create or replace function public.obra_quitar_apoyo(p_obra_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  delete from public.votos where obra_id = p_obra_id and vecino_id = v_uid;

  return jsonb_build_object(
    'success', true,
    'apoyos', coalesce((select apoyos from public.obras where id = p_obra_id), 0)
  );
end;
$$;

-- ------------------------------------------------------- obras_similares --
-- El corazón del "buscar antes de crear": al elegir ciudadela + categoría,
-- se muestra lo que ya existe ANTES de dejar escribir.
create or replace function public.obras_similares(
  p_ciudadela_id uuid,
  p_categoria_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_items   jsonb;
  v_vecinos integer;
begin
  v_vecinos := public.vecinos_en_ciudadela(p_ciudadela_id);

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', o.id,
             'codigo', o.codigo,
             'titulo', o.titulo,
             'descripcion', o.descripcion,
             'foto_url', o.foto_url,
             'apoyos', o.apoyos,
             'porcentaje_ciudadela',
               case when v_vecinos > 0 then round((o.apoyos::numeric / v_vecinos) * 100, 1) else 0 end,
             'estado', jsonb_build_object('nombre', e.nombre, 'color', e.color),
             'ya_apoyada', exists (select 1 from public.votos v where v.obra_id = o.id and v.vecino_id = auth.uid())
           ) order by o.apoyos desc
         ), '[]'::jsonb)
    into v_items
    from public.obras o
    join public.estados e on e.id = o.estado_id
   where o.ciudadela_id = p_ciudadela_id
     and o.categoria_id = p_categoria_id
     and o.aprobada
     and o.fusionada_en is null
     and o.rechazada_en is null;

  return jsonb_build_object('success', true, 'items', v_items);
end;
$$;

-- ------------------------------------------------------------ obra_crear --
create or replace function public.obra_crear(
  p_ciudadela_id uuid,
  p_categoria_id uuid,
  p_titulo       text,
  p_descripcion  text default '',
  p_foto_url     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_vecino   public.vecinos;
  v_estado   uuid;
  v_recientes integer;
  v_obra     public.obras;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  select * into v_vecino from public.vecinos where id = v_uid;
  if v_vecino.id is null then
    return jsonb_build_object('success', false, 'error_code', 'vecino_no_registrado');
  end if;

  if length(trim(coalesce(p_titulo, ''))) < 8 then
    return jsonb_build_object('success', false, 'error_code', 'titulo_muy_corto');
  end if;

  -- Solo puede pedir en su propia ciudadela, igual que para apoyar.
  if p_ciudadela_id is distinct from v_vecino.ciudadela_id then
    return jsonb_build_object('success', false, 'error_code', 'fuera_de_tu_ciudadela');
  end if;

  if not exists (
    select 1 from public.categorias ct
     where ct.id = p_categoria_id and ct.ciudad_id = v_vecino.ciudad_id and ct.activa
  ) then
    return jsonb_build_object('success', false, 'error_code', 'categoria_invalida');
  end if;

  -- Anti-inundación: máximo 3 pedidos por vecino por día.
  select count(*)::integer into v_recientes
    from public.obras o
   where o.creador_id = v_uid and o.creada_en > now() - interval '24 hours';
  if v_recientes >= 3 then
    return jsonb_build_object('success', false, 'error_code', 'demasiados_pedidos_hoy');
  end if;

  select e.id into v_estado
    from public.estados e
   where e.ciudad_id = v_vecino.ciudad_id and e.es_inicial and e.activo;
  if v_estado is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_estado_inicial');
  end if;

  insert into public.obras (
    ciudad_id, ciudadela_id, categoria_id, estado_id,
    titulo, descripcion, foto_url, origen, creador_id, aprobada
  ) values (
    v_vecino.ciudad_id, p_ciudadela_id, p_categoria_id, v_estado,
    trim(p_titulo), coalesce(trim(p_descripcion), ''), p_foto_url, 'vecino', v_uid, false
  )
  returning * into v_obra;

  -- Quien pide una obra la apoya de entrada.
  insert into public.votos (obra_id, vecino_id, ciudad_id)
  values (v_obra.id, v_uid, v_obra.ciudad_id)
  on conflict do nothing;

  return jsonb_build_object(
    'success', true,
    'obra', jsonb_build_object('id', v_obra.id, 'codigo', v_obra.codigo, 'aprobada', false),
    'mensaje', 'Tu pedido entró a revisión. Te avisamos cuando se publique.'
  );
end;
$$;

comment on function public.obra_crear is 'Crea el pedido en estado inicial y sin aprobar. Pasa por la cola del equipo.';

-- -------------------------------------------------------- ranking_barrio --
-- Top de la ciudadela del vecino, para la portada.
create or replace function public.ranking_ciudadela(
  p_ciudadela_id uuid,
  p_limite       integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_items   jsonb;
  v_vecinos integer;
begin
  v_vecinos := public.vecinos_en_ciudadela(p_ciudadela_id);

  select coalesce(jsonb_agg(fila order by orden), '[]'::jsonb)
    into v_items
    from (
      select jsonb_build_object(
               'id', o.id,
               'codigo', o.codigo,
               'titulo', o.titulo,
               'apoyos', o.apoyos,
               'porcentaje_ciudadela',
                 case when v_vecinos > 0 then round((o.apoyos::numeric / v_vecinos) * 100, 1) else 0 end,
               'posicion', row_number() over (order by o.apoyos desc, o.creada_en asc),
               'categoria', jsonb_build_object('nombre', ct.nombre, 'icono', ct.icono),
               'estado', jsonb_build_object('nombre', e.nombre, 'color', e.color),
               'ya_apoyada', exists (select 1 from public.votos v where v.obra_id = o.id and v.vecino_id = auth.uid())
             ) as fila,
             row_number() over (order by o.apoyos desc, o.creada_en asc) as orden
        from public.obras o
        join public.categorias ct on ct.id = o.categoria_id
        join public.estados    e  on e.id  = o.estado_id
       where o.ciudadela_id = p_ciudadela_id
         and o.aprobada and o.fusionada_en is null and o.rechazada_en is null
       order by o.apoyos desc, o.creada_en asc
       limit greatest(p_limite, 1)
    ) t;

  return jsonb_build_object('success', true, 'vecinos_ciudadela', v_vecinos, 'items', v_items);
end;
$$;

-- --------------------------------------------------------- ciudad_portada --
-- Todo lo que necesita la portada en una sola llamada.
create or replace function public.ciudad_portada(p_ciudad_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ciudad public.ciudades;
  v_portal public.portal;
  v_total_vecinos integer;
  v_total_obras   integer;
  v_total_apoyos  integer;
begin
  select * into v_ciudad from public.ciudades where slug = p_ciudad_slug and activa;
  if v_ciudad.id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudad_no_encontrada');
  end if;

  select * into v_portal from public.portal where ciudad_id = v_ciudad.id;

  select count(*)::integer into v_total_vecinos from public.vecinos where ciudad_id = v_ciudad.id;
  select count(*)::integer into v_total_obras from public.obras
   where ciudad_id = v_ciudad.id and aprobada and fusionada_en is null;
  select coalesce(sum(apoyos), 0)::integer into v_total_apoyos from public.obras
   where ciudad_id = v_ciudad.id and aprobada and fusionada_en is null;

  return jsonb_build_object(
    'success', true,
    'ciudad', jsonb_build_object(
      'id', v_ciudad.id, 'slug', v_ciudad.slug, 'nombre', v_ciudad.nombre,
      'provincia', v_ciudad.provincia, 'modo', v_ciudad.modo,
      'poblacion_urbana', v_ciudad.poblacion_urbana
    ),
    'portal', case when v_portal.ciudad_id is null then null else
      jsonb_build_object(
        'candidato_nombre', v_portal.candidato_nombre,
        'candidato_cargo', v_portal.candidato_cargo,
        'partido', v_portal.partido,
        'eslogan', v_portal.eslogan,
        'bio', v_portal.bio,
        'foto_url', v_portal.foto_url,
        'banner_url', v_portal.banner_url,
        'video_url', v_portal.video_url,
        'video_portada_url', v_portal.video_portada_url,
        'logo_url', v_portal.logo_url,
        'color_marca', v_portal.color_marca,
        'redes', v_portal.redes
      ) end,
    'cifras', jsonb_build_object(
      'vecinos', v_total_vecinos,
      'obras', v_total_obras,
      'apoyos', v_total_apoyos
    )
  );
end;
$$;
