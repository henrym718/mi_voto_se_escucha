-- ============================================================================
-- smoke-canales — el único WhatsApp que queda, y la única salida de teléfonos.
--
-- Dos cosas que proteger, y las dos por razones de plata o de confianza:
--   1. Un enlace de canal malo manda al vecino a cualquier parte justo en el
--      momento en que más confía en la plataforma. Se valida antes de guardar.
--   2. Los teléfonos del padrón son EL activo. Solo salen por una puerta, por
--      sector, con permiso de edición, y dejando constancia de quién los sacó.
--
-- Correr con: ./scripts/run-smokes.sh canales
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages to warning;

begin;

create temp table t_results (n serial, test text, pass boolean, detail text) on commit drop;

create function pg_temp.chk(p_test text, p_pass boolean, p_detail text default '') returns void
language sql as $$
  insert into t_results (test, pass, detail) values (p_test, coalesce(p_pass, false), p_detail);
$$;

create function pg_temp.act_as(p_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end; $$;

create function pg_temp.act_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end; $$;

create function pg_temp.crear_admin(p_rol text) returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
          p_rol || '-' || v_id || '@prueba.local', now(), now());
  insert into public.admins (id, ciudad_id, rol, nombre)
  values (v_id, (select id from public.ciudades where slug = 'el-triunfo'), p_rol, p_rol);
  return v_id;
end; $$;

create function pg_temp.crear_sesion() returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, is_anonymous, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
          true, now(), now());
  return v_id;
end; $$;

do $t$
declare
  v_ciudad    uuid;
  v_arb2      uuid;
  v_arb3      uuid;
  v_editor    uuid;
  v_candidato uuid;
  v_intruso   uuid;
  v_uno       uuid;
  v_dos       uuid;
  v_r         jsonb;
  v_n         integer;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';
  select id into v_arb2 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-2';
  select id into v_arb3 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-3';

  delete from public.votos;
  delete from public.vecinos;

  v_editor    := pg_temp.crear_admin('editor');
  v_candidato := pg_temp.crear_admin('candidato');
  v_intruso   := pg_temp.crear_sesion();

  -- A: guardar los enlaces ---------------------------------------------------
  perform pg_temp.act_as(v_editor);
  v_r := public.admin_canales_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('id', v_arb2, 'nombre', 'Arbolito 2',
                       'enlace_canal', 'https://chat.whatsapp.com/AbCd1234EfGh')
  ));
  perform pg_temp.chk('A1 — el editor guarda el enlace del canal de un sector',
    (v_r ->> 'success')::boolean, v_r::text);

  perform pg_temp.chk('A2 — el enlace queda en la ciudadela',
    (select enlace_canal from public.ciudadelas where id = v_arb2)
      = 'https://chat.whatsapp.com/AbCd1234EfGh',
    coalesce((select enlace_canal from public.ciudadelas where id = v_arb2), 'null'));

  -- Un enlace que no es de WhatsApp mandaría al vecino a cualquier parte desde
  -- la pantalla de confirmación, que es el momento de máxima confianza.
  v_r := public.admin_canales_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('id', v_arb3, 'nombre', 'Arbolito 3',
                       'enlace_canal', 'https://sitio-raro.example/entrar')
  ));
  perform pg_temp.chk('A3 — un enlace que no es de WhatsApp se rechaza',
    v_r ->> 'error_code' = 'enlace_invalido', v_r ->> 'error_code');

  perform pg_temp.chk('A4 — y dice de qué sector era, para poder corregirlo',
    v_r ->> 'detalle' = 'Arbolito 3', v_r ->> 'detalle');

  perform pg_temp.chk('A5 — el rechazo no dejó nada guardado a medias',
    (select enlace_canal from public.ciudadelas where id = v_arb3) is null,
    coalesce((select enlace_canal from public.ciudadelas where id = v_arb3), 'null'));

  -- El enlace de canal de WhatsApp (el de difusión) también vale.
  v_r := public.admin_canales_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('id', v_arb3, 'nombre', 'Arbolito 3',
                       'enlace_canal', 'https://whatsapp.com/channel/0029Va1234')
  ));
  perform pg_temp.chk('A6 — un canal de difusión de WhatsApp sí se acepta',
    (v_r ->> 'success')::boolean, v_r::text);

  -- Vaciar el campo quita el enlace: un canal se puede cerrar.
  v_r := public.admin_canales_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('id', v_arb3, 'nombre', 'Arbolito 3', 'enlace_canal', '')
  ));
  perform pg_temp.chk('A7 — mandar el campo vacío borra el enlace',
    (select enlace_canal from public.ciudadelas where id = v_arb3) is null, '');

  -- B: quién puede tocarlo ---------------------------------------------------
  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_canales_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('id', v_arb2, 'nombre', 'Arbolito 2',
                       'enlace_canal', 'https://chat.whatsapp.com/Intruso')
  ));
  perform pg_temp.chk('B1 — el candidato (solo lectura) NO puede cambiar enlaces',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  perform pg_temp.act_as(v_intruso);
  v_r := public.admin_canales_guardar(v_ciudad, '[]'::jsonb);
  perform pg_temp.chk('B2 — alguien de fuera tampoco', v_r ->> 'error_code' = 'sin_permiso',
    v_r ->> 'error_code');

  perform pg_temp.chk('B3 — y el enlace bueno siguió intacto tras los dos intentos',
    (select enlace_canal from public.ciudadelas where id = v_arb2)
      = 'https://chat.whatsapp.com/AbCd1234EfGh', '');

  -- C: el vecino ve el enlace de su sector -----------------------------------
  -- Es lo que cierra el bucle: acaba de publicar y entra al canal de un toque.
  v_uno := pg_temp.crear_sesion();
  perform pg_temp.act_as(v_uno);
  v_r := public.vecino_guardar_contacto('el-triunfo', '0991110001', v_arb2, true);
  perform pg_temp.chk('C1 — al dejar su número con "quiero el canal" recibe el enlace',
    v_r ->> 'enlace_canal' = 'https://chat.whatsapp.com/AbCd1234EfGh', v_r::text);

  v_dos := pg_temp.crear_sesion();
  perform pg_temp.act_as(v_dos);
  v_r := public.vecino_guardar_contacto('el-triunfo', '0991110002', v_arb2, false);
  perform pg_temp.chk('C2 — a quien no lo pidió no se le devuelve enlace ninguno',
    v_r ->> 'enlace_canal' is null, v_r::text);

  -- D: la lista del panel ----------------------------------------------------
  perform pg_temp.act_as(v_editor);
  v_r := public.admin_canales_listar(v_ciudad);
  perform pg_temp.chk('D1 — el panel lista todos los sectores de la ciudad',
    jsonb_array_length(v_r -> 'items') >= 70, jsonb_array_length(v_r -> 'items')::text);

  select count(*) into v_n
    from jsonb_array_elements(v_r -> 'items') i
   where (i ->> 'id')::uuid = v_arb2 and (i ->> 'contactos')::integer = 2
     and (i ->> 'esperando')::integer = 1;
  perform pg_temp.chk('D2 — y dice cuántos contactos tiene y cuántos esperan entrar',
    v_n = 1, v_n::text);

  -- E: la puerta de los teléfonos --------------------------------------------
  v_r := public.admin_contactos_sector(v_arb2);
  perform pg_temp.chk('E1 — el editor puede sacar los contactos de un sector',
    (v_r ->> 'success')::boolean, v_r::text);
  perform pg_temp.chk('E2 — y salen los dos, normalizados',
    jsonb_array_length(v_r -> 'items') = 2, jsonb_array_length(v_r -> 'items')::text);

  v_r := public.admin_contactos_sector(v_arb2, true);
  perform pg_temp.chk('E3 — se puede filtrar solo a quienes pidieron el canal',
    jsonb_array_length(v_r -> 'items') = 1, jsonb_array_length(v_r -> 'items')::text);

  -- Sacar teléfonos no puede ser un acto invisible.
  select count(*) into v_n from public.bitacora
   where accion = 'exportar_contactos' and entidad_id = v_arb2;
  perform pg_temp.chk('E4 — cada exportación queda anotada en la bitácora', v_n = 2, v_n::text);

  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_contactos_sector(v_arb2);
  perform pg_temp.chk('E5 — el candidato (solo lectura) NO puede sacar teléfonos',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  perform pg_temp.act_as(v_intruso);
  v_r := public.admin_contactos_sector(v_arb2);
  perform pg_temp.chk('E6 — alguien de fuera tampoco',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  perform pg_temp.act_as(v_editor);
  v_r := public.admin_contactos_sector(gen_random_uuid());
  perform pg_temp.chk('E7 — un sector inventado da error controlado, no una excepción',
    v_r ->> 'error_code' = 'ciudadela_invalida', v_r ->> 'error_code');

exception when others then
  perform pg_temp.chk('EXCEPCIÓN no controlada en la suite', false, sqlerrm);
end $t$;

select case when pass then '✅ PASS ' else '❌ FALLA' end || ' | ' || test as resultado, detail
  from t_results order by n;

do $$
declare v_fallas integer;
begin
  select count(*) into v_fallas from t_results where not pass;
  if v_fallas > 0 then
    raise exception 'smoke-canales: % en rojo', v_fallas;
  end if;
end $$;

rollback;
