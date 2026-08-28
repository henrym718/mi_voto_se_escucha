-- ============================================================================
-- Orden estable del listado público.
--
-- El síntoma: apoyas una obra, la lista se recarga y media pantalla cambia de
-- sitio — obras que no tocaste suben, bajan o se intercambian. Parecía que el
-- apoyo se estaba yendo a la obra equivocada.
--
-- La causa: `obras_listar` ordenaba solo por relevancia y apoyos. En una ciudad
-- recién abierta casi todas las obras tienen los mismos apoyos (0 o 1), así que
-- el desempate quedaba en manos de Postgres, que devuelve las filas empatadas
-- en el orden que le convenga a cada plan. Dos consultas idénticas, dos ordenes
-- distintos: la lista se barajaba sola en cada refetch.
--
-- La corrección: desempatar por `creada_en desc, id`. `id` es único, así que el
-- orden queda totalmente determinado y una obra solo se mueve cuando de verdad
-- cambió de puesto. El par (apoyos desc, creada_en desc) es justo el que ya
-- tiene el índice `obras_listado_publico`, así que no cuesta nada.
-- ============================================================================

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
  select coalesce(jsonb_agg(fila order by orden_relevancia, orden_apoyos, orden_reciente, orden_creada desc, orden_id), '[]'::jsonb)
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
             end as orden_reciente,
             -- Desempate estable: sin esto, las obras empatadas en apoyos
             -- (que en una ciudad nueva son casi todas) salen en el orden que
             -- le convenga al plan de esa consulta, y cambian de sitio solas en
             -- cada refetch. Coincide con el indice obras_listado_publico.
             b.creada_en as orden_creada,
             b.id        as orden_id
        from base b
       where b.relevancia >= v_umbral
       -- El order by va ANTES del limit/offset: sin él, la página 2 podría
       -- repetir obras de la página 1 (el orden de un scan no está garantizado).
       order by orden_relevancia, orden_apoyos, orden_reciente, orden_creada desc, orden_id
       limit greatest(p_limite, 1)
      offset greatest(p_desde, 0)
    ) t;

  return jsonb_build_object('success', true, 'total', v_total, 'items', v_items);
end;
$$;
