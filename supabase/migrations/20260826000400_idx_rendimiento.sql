-- ============================================================================
-- Índices de las consultas que se ejecutan en cada visita.
-- ============================================================================

-- Listado público: filtra por ciudad y ordena por apoyos. El índice parcial
-- deja fuera lo no aprobado y lo fusionado, que es la mayoría del ruido.
create index obras_listado_publico
  on public.obras (ciudad_id, apoyos desc, creada_en desc)
  where aprobada and fusionada_en is null and rechazada_en is null;

create index obras_por_ciudadela
  on public.obras (ciudadela_id, apoyos desc)
  where aprobada and fusionada_en is null;

create index obras_por_categoria
  on public.obras (ciudad_id, categoria_id)
  where aprobada and fusionada_en is null;

-- Kanban del panel: obras agrupadas por columna.
create index obras_por_estado
  on public.obras (estado_id, apoyos desc)
  where aprobada and fusionada_en is null;

-- Cola de aprobación.
create index obras_en_cola
  on public.obras (ciudad_id, creada_en)
  where not aprobada and rechazada_en is null and fusionada_en is null;

create index obras_por_creador on public.obras (creador_id, creada_en desc);

-- Búsqueda por texto en título y descripción.
create index obras_texto
  on public.obras using gin (to_tsvector('spanish', coalesce(titulo, '') || ' ' || descripcion));

-- Detección de duplicados en la cola: el título del pedido nuevo contra los ya
-- aprobados de su sector. Sin este índice cada revisión recorre toda la ciudad.
create index obras_titulo_trgm
  on public.obras using gin (public.fn_search_norm(titulo) public.gin_trgm_ops);

-- "¿Ya apoyé esta obra?" se pregunta en cada tarjeta del listado.
create index votos_por_vecino on public.votos (vecino_id, obra_id);

-- Línea de tiempo de una obra.
create index publicaciones_por_obra on public.publicaciones (obra_id, creada_en desc);

-- Conteo de vecinos por ciudadela: base del porcentaje, se llama por cada obra.
create index vecinos_por_ciudadela on public.vecinos (ciudadela_id);
create index vecinos_por_ciudad on public.vecinos (ciudad_id);

-- Exportar los contactos de un sector para sumarlos al canal de WhatsApp.
create index vecinos_con_telefono
  on public.vecinos (ciudad_id, ciudadela_id)
  where telefono is not null;

-- Recuento y migración de apoyos al fusionar duplicados.
create index votos_por_obra on public.votos (obra_id, vecino_id);
