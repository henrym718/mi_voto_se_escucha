-- ============================================================================
-- Almacenamiento de imágenes y video.
--
--   obras         fotos que sube el vecino con su pedido
--   publicaciones fotos y videos que sube el equipo con cada avance
--   portal        banner, foto del candidato, logo y video de presentación
--
-- Todos de lectura pública (son contenido para mostrar) y escritura acotada.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('obras', 'obras', true, 8388608,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('publicaciones', 'publicaciones', true, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('portal', 'portal', true, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;

-- --------------------------------------------------------------- lectura --
create policy "las imágenes de obras son públicas"
  on storage.objects for select
  using (bucket_id in ('obras', 'publicaciones', 'portal'));

-- -------------------------------------------------- escritura del vecino --
-- Un vecino verificado puede subir la foto de su pedido, y solo dentro de la
-- carpeta que lleva su propio identificador. Así nadie pisa archivos ajenos.
create policy "el vecino sube la foto de su pedido"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'obras'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "el vecino puede borrar sus propias fotos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'obras'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------- escritura del equipo --
-- El equipo sube avances y contenido del portal. La carpeta raíz es la ciudad,
-- y la función de permiso comprueba que de verdad pertenezca a esa ciudad.
create policy "el equipo sube avances y contenido"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('publicaciones', 'portal')
    and public.puede_editar(((storage.foldername(name))[1])::uuid)
  );

create policy "el equipo gestiona sus archivos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('publicaciones', 'portal')
    and public.puede_editar(((storage.foldername(name))[1])::uuid)
  );

create policy "el equipo borra sus archivos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('publicaciones', 'portal')
    and public.puede_editar(((storage.foldername(name))[1])::uuid)
  );
