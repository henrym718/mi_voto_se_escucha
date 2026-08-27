-- ============================================================================
-- RPC públicas del dominio: listar, ver, apoyar y publicar pedidos.
--
-- Apoyar es el acto que sostiene todo el producto, así que tiene exactamente
-- una regla: un apoyo por persona por obra, garantizado por el índice único de
-- `votos`. Se puede apoyar cualquier causa del cantón, no solo las del propio
-- barrio: la portada abre en "Todo el cantón / Más apoyadas" y un botón que
-- falla en la mayoría de las tarjetas mata la conversión. El sector del vecino
-- se sigue guardando, pero para segmentar su contacto, no para limitar su voto.
--
-- El mapa de demanda no se ensucia por eso: una obra pertenece al sector donde
-- está el problema, no al sector de quien la apoya.
-- ============================================================================

-- Cuántos vecinos declararon vivir en una ciudadela. Solo la usa el panel.
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
  p_limite       integer default 10,
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
begin
  select o.*,
         cd.nombre as ciudadela_nombre, cd.slug as ciudadela_slug, cd.enlace_canal,
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
      'origen', v_obra.origen,
      'fuente', v_obra.fuente,
      'aprobada', v_obra.aprobada,
      'creada_en', v_obra.creada_en,
      'ciudad', jsonb_build_object('slug', v_obra.ciudad_slug, 'nombre', v_obra.ciudad_nombre),
      'ciudadela', jsonb_build_object('id', v_obra.ciudadela_id, 'nombre', v_obra.ciudadela_nombre,
                                      'slug', v_obra.ciudadela_slug, 'enlace_canal', v_obra.enlace_canal),
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
-- Un toque y listo. La ficha del vecino se crea aquí si es su primer acto: así
-- el padrón cuenta a quien participó, no a quien pasó por la portada.
create or replace function public.obra_apoyar(p_obra_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_obra public.obras;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  select * into v_obra from public.obras where id = p_obra_id;
  if v_obra.id is null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_encontrada');
  end if;
  if not v_obra.aprobada or v_obra.fusionada_en is not null or v_obra.rechazada_en is not null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_disponible');
  end if;

  perform public.vecino_asegurar_interno(v_obra.ciudad_id);

  insert into public.votos (obra_id, vecino_id, ciudad_id)
  values (p_obra_id, v_uid, v_obra.ciudad_id)
  on conflict (obra_id, vecino_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'apoyos', (select apoyos from public.obras where id = p_obra_id)
  );
end;
$$;

comment on function public.obra_apoyar is 'Un apoyo por persona por obra, en cualquier sector del cantón.';

-- ----------------------------------------------------- obra_quitar_apoyo --
create or replace function public.obra_quitar_apoyo(p_obra_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  delete from public.votos where obra_id = p_obra_id and vecino_id = auth.uid();

  return jsonb_build_object(
    'success', true,
    'apoyos', coalesce((select apoyos from public.obras where id = p_obra_id), 0)
  );
end;
$$;

-- ------------------------------------------------------------ obra_crear --
-- El vecino elige sector y categoría, habla veinte segundos o escribe una
-- frase, y termina. No espera a nada: la obra entra sin título, marcada como
-- pendiente de la IA, y quien la ordena y la revisa es el equipo.
--
-- El sector es el del PROBLEMA, no el del vecino: alguien puede reportar el
-- hueco que ve todos los días camino al trabajo.
create or replace function public.obra_crear(
  p_ciudadela_id  uuid,
  p_categoria_id  uuid,
  p_texto         text default null,
  p_audio_url     text default null,
  p_foto_url      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_ciudad_id uuid;
  v_estado    uuid;
  v_recientes integer;
  v_obra      public.obras;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  -- Sin nada que contar no hay pedido: ni texto ni nota de voz.
  if coalesce(trim(p_texto), '') = '' and coalesce(trim(p_audio_url), '') = '' then
    return jsonb_build_object('success', false, 'error_code', 'sin_contenido');
  end if;

  select cd.ciudad_id into v_ciudad_id
    from public.ciudadelas cd
   where cd.id = p_ciudadela_id and cd.activa;
  if v_ciudad_id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudadela_invalida');
  end if;

  if not exists (
    select 1 from public.categorias ct
     where ct.id = p_categoria_id and ct.ciudad_id = v_ciudad_id and ct.activa
  ) then
    return jsonb_build_object('success', false, 'error_code', 'categoria_invalida');
  end if;

  perform public.vecino_asegurar_interno(v_ciudad_id);

  -- Anti-inundación: máximo 3 pedidos por persona por día.
  select count(*)::integer into v_recientes
    from public.obras o
   where o.creador_id = v_uid and o.creada_en > now() - interval '24 hours';
  if v_recientes >= 3 then
    return jsonb_build_object('success', false, 'error_code', 'demasiados_pedidos_hoy');
  end if;

  select e.id into v_estado
    from public.estados e
   where e.ciudad_id = v_ciudad_id and e.es_inicial and e.activo;
  if v_estado is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_estado_inicial');
  end if;

  insert into public.obras (
    ciudad_id, ciudadela_id, categoria_id, estado_id,
    texto_original, audio_url, foto_url, ia_estado, origen, creador_id, aprobada
  ) values (
    v_ciudad_id, p_ciudadela_id, p_categoria_id, v_estado,
    nullif(trim(coalesce(p_texto, '')), ''), nullif(trim(coalesce(p_audio_url, '')), ''),
    p_foto_url, 'pendiente', 'vecino', v_uid, false
  )
  returning * into v_obra;

  -- Quien pide una obra la apoya de entrada.
  insert into public.votos (obra_id, vecino_id, ciudad_id)
  values (v_obra.id, v_uid, v_obra.ciudad_id)
  on conflict do nothing;

  return jsonb_build_object(
    'success', true,
    'obra', jsonb_build_object('id', v_obra.id, 'codigo', v_obra.codigo),
    'enlace_canal', (select cd.enlace_canal from public.ciudadelas cd where cd.id = p_ciudadela_id)
  );
end;
$$;

comment on function public.obra_crear is 'Entra sin título y pendiente de IA. El vecino no espera; ordena y revisa el equipo.';

-- ------------------------------------------------------ obra_ia_resultado --
-- La escribe la ruta del servidor después de transcribir y ordenar. Va por RPC
-- y no por UPDATE directo para que el estado de la IA no se pueda dejar a medias
-- desde el navegador.
create or replace function public.obra_ia_resultado(
  p_obra_id       uuid,
  p_titulo        text,
  p_descripcion   text,
  p_transcripcion text default null,
  p_fallo         boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text := nullif(trim(coalesce(p_titulo, '')), '');
begin
  if p_fallo or v_titulo is null or length(v_titulo) < 8 then
    update public.obras
       set ia_estado     = 'fallido',
           transcripcion = coalesce(nullif(trim(coalesce(p_transcripcion, '')), ''), transcripcion)
     where id = p_obra_id;
    return jsonb_build_object('success', true, 'ia_estado', 'fallido');
  end if;

  update public.obras
     set titulo        = left(v_titulo, 120),
         descripcion   = left(coalesce(trim(p_descripcion), ''), 1000),
         transcripcion = coalesce(nullif(trim(coalesce(p_transcripcion, '')), ''), transcripcion),
         ia_estado     = 'listo'
   where id = p_obra_id;

  return jsonb_build_object('success', true, 'ia_estado', 'listo');
end;
$$;

revoke all on function public.obra_ia_resultado(uuid, text, text, text, boolean)
  from public, anon, authenticated;

comment on function public.obra_ia_resultado is 'Solo la llama el servidor con service_role, nunca el navegador.';

-- -------------------------------------------------------- ranking_barrio --
-- Top de un sector. Lo usa la portada cuando el vecino filtra su barrio.
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
  v_items jsonb;
begin
  select coalesce(jsonb_agg(fila order by orden), '[]'::jsonb)
    into v_items
    from (
      select jsonb_build_object(
               'id', o.id,
               'codigo', o.codigo,
               'titulo', o.titulo,
               'apoyos', o.apoyos,
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

  return jsonb_build_object('success', true, 'items', v_items);
end;
$$;
