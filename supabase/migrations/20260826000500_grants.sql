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
--
-- Nota sobre `anon` frente a `authenticated`: el vecino navega con una sesión
-- anónima de Supabase Auth, así que llega como `authenticated` aunque nunca se
-- haya registrado. `anon` es solo el instante entre que abre la página y que la
-- sesión se crea, y por eso conserva la lectura del catálogo: en ese medio
-- segundo la portada ya tiene que estar pintada.
-- ============================================================================

-- Poder entrar al esquema es requisito de todo lo demás.
grant usage on schema public to anon, authenticated, service_role;

-- ── Igualar la nube con lo local ─────────────────────────────────────────────
-- En la nube de Supabase, las tablas creadas por `postgres` pueden nacer con
-- privilegios ya repartidos a anon/authenticated (default privileges legados);
-- en local, con la CLI nueva, no. smoke-rls C3/C4 lo detectó en staging: el
-- anónimo tenía UPDATE sobre obras aunque este archivo nunca se lo dio (las
-- filas seguían a salvo por RLS, pero una capa de defensa estaba caída y los
-- smokes pasaban en un mundo y fallaban en el otro). Se revoca TODO y las
-- líneas de abajo vuelven a abrir exactamente lo necesario, igual en ambos.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ------------------------------------------------ catálogo público: lectura --
-- Mirar no exige nada: cualquiera ve la ciudad, sus barrios, sus categorías,
-- sus estados y las obras aprobadas. Es la base de la conversión.
grant select on public.ciudades      to anon, authenticated;
grant select on public.portal        to anon, authenticated;
grant select on public.ciudadelas    to anon, authenticated;
grant select on public.categorias    to anon, authenticated;
grant select on public.estados       to anon, authenticated;
grant select on public.obras         to anon, authenticated;
grant select on public.publicaciones to anon, authenticated;

-- --------------------------------------------- vecino autenticado: su ficha --
-- La política RLS limita las filas a las suyas; el GRANT solo abre la tabla.
-- Sin UPDATE: la ficha se escribe por RPC, que es donde se normaliza el número.
grant select on public.vecinos to authenticated;
grant select on public.votos   to authenticated;

-- ------------------------------------------------------- equipo del panel --
-- El equipo entra con correo y contraseña; lo que lo distingue de un vecino es
-- su fila en `admins` y las políticas que la consultan.
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
-- Las rutas del servidor (la que procesa la nota de voz). RLS no le aplica
-- (bypassrls), pero sin el GRANT tampoco llegaría a la tabla.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ------------------------------------------------------------- funciones --
-- Las RPC públicas quedan invocables; cada una valida por dentro quién llama.
grant execute on function public.obras_listar(text, uuid, uuid, uuid, text, text, integer, integer) to anon, authenticated;
grant execute on function public.obra_detalle(uuid, text)          to anon, authenticated;
grant execute on function public.ranking_ciudadela(uuid, integer)  to anon, authenticated;
-- ciudad_portada, portal_perfiles, portal_perfil y las del panel de contenido
-- se otorgan en su propia migración, que es donde nacen.

grant execute on function public.vecino_yo()                                          to authenticated;
grant execute on function public.vecino_guardar_contacto(text, text, uuid, boolean, text) to authenticated;
grant execute on function public.vecino_elegir_ciudadela(uuid)                        to authenticated;
grant execute on function public.obra_apoyar(uuid)                                    to authenticated;
grant execute on function public.obra_quitar_apoyo(uuid)                              to authenticated;
grant execute on function public.obra_crear(uuid, uuid, text, text, text)             to authenticated;

grant execute on function public.admin_tablero(uuid, uuid, uuid)                      to authenticated;
grant execute on function public.admin_ranking(uuid, uuid)                            to authenticated;
grant execute on function public.admin_cola_aprobacion(uuid)                          to authenticated;
grant execute on function public.admin_obras_parecidas(uuid)                          to authenticated;
grant execute on function public.admin_obra_aprobar(uuid, text, text, uuid)           to authenticated;
grant execute on function public.admin_obra_rechazar(uuid, text)                      to authenticated;
grant execute on function public.admin_obra_cambiar_estado(uuid, uuid, text, jsonb)   to authenticated;
grant execute on function public.admin_obras_fusionar(uuid, uuid[])                   to authenticated;
grant execute on function public.admin_estados_guardar(uuid, jsonb)                   to authenticated;
grant execute on function public.admin_canales_guardar(uuid, jsonb)                   to authenticated;
grant execute on function public.admin_canales_listar(uuid)                           to authenticated;
grant execute on function public.admin_contactos_sector(uuid, boolean)                to authenticated;

-- ── Cerrar la puerta de las funciones del panel ──────────────────────────────
-- Postgres concede EXECUTE a PUBLIC en toda función nueva, así que sin esto la
-- lista de arriba es decorativa: un visitante anónimo podía invocar cualquier
-- `admin_*`. No filtraba nada —cada una comprueba el rol por dentro y devuelve
-- `sin_permiso`— pero dejaba caída una capa entera de defensa, y la suite
-- smoke-rls prueba justamente eso. Se hace en bucle para que una función nueva
-- del panel nazca cerrada sin que nadie tenga que acordarse.
create or replace function public.cerrar_funciones_admin()
returns void
language plpgsql
as $cerrar$
declare v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'admin\_%'
  loop
    execute format('revoke execute on function %s from public, anon', v_fn.firma);
  end loop;
end;
$cerrar$;

comment on function public.cerrar_funciones_admin is 'La vuelve a llamar toda migración que añada una RPC admin_*.';

select public.cerrar_funciones_admin();

-- Nada de esto lo toca el navegador jamás.
revoke execute on function public.anotar_bitacora(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.anotar_bitacora(uuid, text, text, uuid, jsonb) to service_role;
grant  execute on function public.obra_ia_resultado(uuid, text, text, text, boolean) to service_role;
grant  execute on function public.vecino_asegurar_interno(uuid, text) to service_role;

-- Que lo nuevo herede lo mismo sin tener que acordarse.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
