-- ============================================================================
-- smoke-voto — las reglas del apoyo, que son las que sostienen el dato.
--
-- Al quitar el OTP quedó UNA sola regla, y si se rompe el ranking que se le
-- vende al candidato deja de significar algo: un apoyo por persona por obra.
--
-- La que se fue —"solo apoyas en tu ciudadela"— tiene aquí su propia prueba en
-- negativo (bloque C): la portada abre en "todo el cantón" y un botón Apoyar
-- que falla en la mayoría de las tarjetas mataría la conversión. Se comprueba
-- que se puede apoyar fuera del barrio propio, a propósito.
--
-- Correr con: ./scripts/run-smokes.sh voto
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

-- Una sesión anónima de Supabase: una fila en auth.users sin teléfono ni
-- correo. Es exactamente lo que crea `signInAnonymously` en el navegador, y
-- por eso la ficha de `vecinos` NO se crea aquí: nace sola al primer apoyo.
create function pg_temp.crear_sesion() returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
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
  v_obra2     uuid;   -- obra de Arbolito 2
  v_obra3     uuid;   -- obra de Arbolito 3
  v_uno       uuid;
  v_dos       uuid;
  v_tres      uuid;
  v_r         jsonb;
  v_n         integer;
  v_i         integer;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';
  select id into v_arb2 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-2';
  select id into v_arb3 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-3';
  select id into v_obra2 from public.obras where ciudadela_id = v_arb2 and aprobada limit 1;
  select id into v_obra3 from public.obras where ciudadela_id = v_arb3 and aprobada limit 1;

  -- Esta suite cuenta apoyos, así que necesita partir de un estado conocido.
  -- Puede permitírselo porque toda la suite vive dentro de una transacción que
  -- termina en rollback: la base queda igual que estaba. Sin esto, correrla
  -- sobre una base con vecinos reales la pondría en rojo por datos ajenos.
  delete from public.votos;
  delete from public.vecinos;

  v_uno  := pg_temp.crear_sesion();
  v_dos  := pg_temp.crear_sesion();
  v_tres := pg_temp.crear_sesion();

  -- A: el camino feliz, sin haber dado un solo dato ---------------------------
  perform pg_temp.act_as(v_uno);
  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('A1 — se apoya sin registrarse ni dar el teléfono',
    (v_r ->> 'success')::boolean, v_r::text);
  perform pg_temp.chk('A2 — el apoyo queda contado',
    (v_r ->> 'apoyos')::integer = 1, v_r ->> 'apoyos');

  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('A3 — el contador de la obra coincide con la fila creada', v_n = 1, v_n::text);

  select count(*) into v_n from public.votos where obra_id = v_obra2;
  perform pg_temp.chk('A4 — hay exactamente un voto en la tabla', v_n = 1, v_n::text);

  -- La ficha nace en el primer acto real, no al entrar a mirar: el padrón
  -- cuenta participantes, no visitas.
  select count(*) into v_n from public.vecinos where id = v_uno;
  perform pg_temp.chk('A5 — la ficha del vecino se crea sola al primer apoyo', v_n = 1, v_n::text);

  select count(*) into v_n from public.vecinos where id = v_uno and telefono is null;
  perform pg_temp.chk('A6 — y nace sin teléfono: nadie se lo ha pedido todavía', v_n = 1, v_n::text);

  -- B: un apoyo por persona --------------------------------------------------
  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('B1 — apoyar dos veces no da error (es idempotente)',
    (v_r ->> 'success')::boolean, v_r::text);
  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('B2 — pero el contador NO sube dos veces', v_n = 1, 'apoyos=' || v_n);

  -- Insistir diez veces tampoco mueve la aguja.
  for v_i in 1..10 loop
    perform public.obra_apoyar(v_obra2);
  end loop;
  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('B3 — insistir diez veces sigue contando uno', v_n = 1, 'apoyos=' || v_n);

  -- La base lo impide aunque alguien esquive la RPC.
  begin
    insert into public.votos (obra_id, vecino_id, ciudad_id) values (v_obra2, v_uno, v_ciudad);
    perform pg_temp.chk('B4 — el índice único impide el voto duplicado', false, 'lo insertó');
  exception when unique_violation then
    perform pg_temp.chk('B4 — el índice único impide el voto duplicado', true, 'unique_violation');
  end;

  -- C: se apoya en TODO el cantón -------------------------------------------
  -- Esto antes estaba prohibido. Ahora es requisito: la portada abre en "todo
  -- el cantón / más apoyadas" y el botón tiene que funcionar en cada tarjeta.
  perform pg_temp.act_as(v_dos);
  perform public.vecino_guardar_contacto('el-triunfo', '0991000003', v_arb3);

  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('C1 — alguien de Arbolito 3 SÍ puede apoyar una obra de Arbolito 2',
    (v_r ->> 'success')::boolean, v_r::text);
  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('C2 — y ese apoyo cuenta', v_n = 2, 'apoyos=' || v_n);

  -- La obra sigue perteneciendo al sector donde está el problema, no al de
  -- quien la apoya: es lo que mantiene limpio el mapa de calor.
  select count(*) into v_n from public.obras where id = v_obra2 and ciudadela_id = v_arb2;
  perform pg_temp.chk('C3 — la obra sigue siendo de Arbolito 2, no del sector del votante',
    v_n = 1, v_n::text);

  v_r := public.obra_apoyar(v_obra3);
  perform pg_temp.chk('C4 — y también apoya lo de su propio barrio',
    (v_r ->> 'success')::boolean, v_r::text);

  -- D: quien todavía no eligió sector ---------------------------------------
  perform pg_temp.act_as(v_tres);
  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('D1 — sin sector elegido TAMBIÉN se puede apoyar',
    (v_r ->> 'success')::boolean, v_r::text);
  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('D2 — y suma como cualquier otro', v_n = 3, 'apoyos=' || v_n);

  -- E: sin sesión -------------------------------------------------------------
  perform pg_temp.act_anon();
  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('E1 — sin sesión no se puede apoyar',
    v_r ->> 'error_code' = 'sin_sesion', v_r ->> 'error_code');

  -- F: obras que no están disponibles ---------------------------------------
  perform pg_temp.act_as(v_uno);
  update public.obras set aprobada = false where id = v_obra2;
  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('F1 — no se puede apoyar una obra que sigue en la cola de revisión',
    v_r ->> 'error_code' = 'obra_no_disponible', v_r ->> 'error_code');
  update public.obras set aprobada = true where id = v_obra2;

  update public.obras set fusionada_en = v_obra3 where id = v_obra2;
  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('F2 — no se puede apoyar una obra ya fusionada en otra',
    v_r ->> 'error_code' = 'obra_no_disponible', v_r ->> 'error_code');
  update public.obras set fusionada_en = null where id = v_obra2;

  v_r := public.obra_apoyar(gen_random_uuid());
  perform pg_temp.chk('F3 — una obra inexistente da error, no una excepción',
    v_r ->> 'error_code' = 'obra_no_encontrada', v_r ->> 'error_code');

  -- G: quitar el apoyo --------------------------------------------------------
  v_r := public.obra_quitar_apoyo(v_obra2);
  perform pg_temp.chk('G1 — se puede retirar el apoyo', (v_r ->> 'success')::boolean, v_r::text);
  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('G2 — el contador baja al retirarlo', v_n = 2, 'apoyos=' || v_n);

  perform public.obra_quitar_apoyo(v_obra2);
  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('G3 — retirar dos veces no deja el contador en negativo', v_n = 2, 'apoyos=' || v_n);

  -- H: el teléfono, que se pide DESPUÉS y nunca bloquea ----------------------
  perform pg_temp.act_as(v_uno);
  v_r := public.vecino_guardar_contacto('el-triunfo', '0991234567', v_arb2, true);
  perform pg_temp.chk('H1 — el vecino deja su número cuando quiere',
    (v_r ->> 'success')::boolean, v_r::text);

  select count(*) into v_n from public.vecinos where id = v_uno and telefono = '+593991234567';
  perform pg_temp.chk('H2 — se guarda normalizado a E.164, no como lo escribió', v_n = 1, v_n::text);

  v_r := public.vecino_guardar_contacto('el-triunfo', '042345678', v_arb2);
  perform pg_temp.chk('H3 — un fijo de Guayaquil se rechaza antes de ensuciar el padrón',
    v_r ->> 'error_code' = 'telefono_invalido', v_r ->> 'error_code');

  -- Sin verificación, dos personas pueden teclear el mismo número (o alguien
  -- puede equivocarse). Que eso NO reviente es deliberado: si el teléfono fuera
  -- único, el primero que se equivoca deja fuera al dueño real del número.
  perform pg_temp.act_as(v_dos);
  v_r := public.vecino_guardar_contacto('el-triunfo', '0991234567', v_arb3);
  perform pg_temp.chk('H4 — el mismo número en dos fichas no rompe nada',
    (v_r ->> 'success')::boolean, v_r::text);

  -- I: lo que la aplicación pregunta al arrancar ------------------------------
  perform pg_temp.act_as(v_uno);
  v_r := public.vecino_yo();
  perform pg_temp.chk('I1 — vecino_yo dice que ya dejó su teléfono',
    (v_r -> 'vecino' ->> 'tiene_telefono')::boolean, v_r::text);
  perform pg_temp.chk('I2 — y en qué sector se ubicó',
    (v_r -> 'vecino' ->> 'ciudadela_id')::uuid = v_arb2, v_r -> 'vecino' ->> 'ciudadela_id');
  perform pg_temp.chk('I3 — y que pidió entrar al canal de su sector',
    (v_r -> 'vecino' ->> 'quiere_canal')::boolean, v_r::text);

  -- Nunca devuelve el número: la interfaz solo necesita saber si ya lo tiene.
  perform pg_temp.chk('I4 — pero NO devuelve el número a la interfaz',
    (v_r -> 'vecino') ->> 'telefono' is null, (v_r -> 'vecino')::text);

  perform pg_temp.act_anon();
  v_r := public.vecino_yo();
  perform pg_temp.chk('I5 — sin sesión responde sin vecino, no con error',
    (v_r ->> 'success')::boolean and (v_r -> 'vecino') = 'null'::jsonb, v_r::text);

exception when others then
  perform pg_temp.chk('EXCEPCIÓN no controlada en la suite', false, sqlerrm);
end $t$;

select case when pass then 'PASS' else 'FALLA' end as estado, test, detail
  from t_results order by n;

select count(*) filter (where not pass) as fallas, count(*) as total from t_results;

rollback;
