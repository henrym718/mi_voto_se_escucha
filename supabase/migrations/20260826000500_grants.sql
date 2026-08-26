-- ============================================================================
-- Permisos de tabla, explícitos.
--
-- Los privilegios por defecto de Supabase aplican a lo que crea `supabase_admin`,
-- pero las migraciones corren como `postgres`: sin este archivo, anon y
-- authenticated no tienen ni SELECT y toda la aplicación responde
-- "permission denied". Lo detectó la suite smoke-rls.
--
-- Los GRANT abren la puerta a la TABLA; las políticas RLS deciden qué FILAS se
-- ven. Las dos capas son necesarias: quitar cualquiera de las dos rompe algo.
-- Las tablas que no aparecen aquí quedan cerradas a propósito para el cliente
-- (otp_send_log, notificaciones): solo las tocan las funciones y el worker.
-- ============================================================================

-- Poder entrar al esquema es requisito de todo lo demás.
grant usage on schema public to anon, authenticated, service_role;

-- ------------------------------------------------ catálogo público: lectura --
-- Mirar no exige registrarse: el anónimo ve la ciudad, sus barrios, sus
-- categorías, sus estados y las obras aprobadas. Es la base de la conversión.
grant select on public.ciudades      to anon, authenticated;
grant select on public.portal        to anon, authenticated;
grant select on public.ciudadelas    to anon, authenticated;
grant select on public.categorias    to anon, authenticated;
grant select on public.estados       to anon, authenticated;
grant select on public.obras         to anon, authenticated;
grant select on public.publicaciones to anon, authenticated;

-- --------------------------------------------- vecino autenticado: su ficha --
-- La política RLS limita las filas a las suyas; el GRANT solo abre la tabla.
grant select, update on public.vecinos to authenticated;
grant select          on public.votos   to authenticated;

-- ------------------------------------------------------- equipo del panel --
-- El equipo entra autenticado igual que un vecino; lo que lo distingue es su
-- fila en `admins` y las políticas que la consultan.
grant select          on public.admins   to authenticated;
grant insert, update  on public.admins   to authenticated;
grant select          on public.bitacora to authenticated;
grant update          on public.ciudades      to authenticated;
grant update          on public.portal        to authenticated;
grant update          on public.obras         to authenticated;
grant all             on public.ciudadelas    to authenticated;
grant all             on public.categorias    to authenticated;
grant all             on public.estados       to authenticated;

-- ------------------------------------------------------------ service_role --
-- Las Edge Functions y el worker. RLS no le aplica (bypassrls), pero sin el
-- GRANT tampoco llegaría a la tabla.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ------------------------------------------------------------- funciones --
-- Las RPC públicas quedan invocables; cada una valida por dentro quién llama.
grant execute on function public.obras_listar(text, uuid, uuid, uuid, text, text, integer, integer) to anon, authenticated;
grant execute on function public.obra_detalle(uuid, text)          to anon, authenticated;
grant execute on function public.obras_similares(uuid, uuid)       to anon, authenticated;
grant execute on function public.ranking_ciudadela(uuid, integer)  to anon, authenticated;
grant execute on function public.ciudad_portada(text)              to anon, authenticated;
grant execute on function public.vecinos_en_ciudadela(uuid)        to anon, authenticated;

grant execute on function public.vecino_asegurar(text, uuid, text)     to authenticated;
grant execute on function public.vecino_elegir_ciudadela(uuid)         to authenticated;
grant execute on function public.vecino_perfilar(text, text, text)     to authenticated;
grant execute on function public.vecino_darse_de_baja()                to authenticated;
grant execute on function public.obra_apoyar(uuid)                     to authenticated;
grant execute on function public.obra_quitar_apoyo(uuid)               to authenticated;
grant execute on function public.obra_crear(uuid, uuid, text, text, text) to authenticated;

grant execute on function public.admin_tablero(uuid, uuid, uuid)                      to authenticated;
grant execute on function public.admin_ranking(uuid, uuid)                            to authenticated;
grant execute on function public.admin_cola_aprobacion(uuid)                          to authenticated;
grant execute on function public.admin_obra_aprobar(uuid)                             to authenticated;
grant execute on function public.admin_obra_rechazar(uuid, text)                      to authenticated;
grant execute on function public.admin_obra_cambiar_estado(uuid, uuid, text, jsonb, boolean) to authenticated;
grant execute on function public.admin_obras_fusionar(uuid, uuid[])                   to authenticated;
grant execute on function public.admin_estados_guardar(uuid, jsonb)                   to authenticated;
grant execute on function public.admin_difundir(uuid, text, uuid[], uuid[], text, boolean) to authenticated;
grant execute on function public.admin_alcance(uuid, integer)                         to authenticated;

-- Nada de esto lo toca el navegador jamás.
revoke execute on function public.anotar_bitacora(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.anotar_bitacora(uuid, text, text, uuid, jsonb) to service_role;

-- Que lo nuevo herede lo mismo sin tener que acordarse.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
