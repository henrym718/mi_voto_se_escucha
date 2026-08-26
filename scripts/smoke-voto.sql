-- ============================================================================
-- smoke-voto — las reglas del apoyo, que son las que sostienen el dato.
--
-- Dos reglas y nada más, pero si cualquiera de las dos se rompe, el ranking
-- que se le vende al candidato deja de significar algo:
--   1. Un apoyo por persona por obra.
--   2. Se apoya SOLO en la ciudadela propia.
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

create function pg_temp.crear_vecino(p_tel text, p_ciudadela uuid) returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
          p_tel, now(), now());
  insert into public.vecinos (id, ciudad_id, ciudadela_id, telefono)
  values (v_id, (select id from public.ciudades where slug = 'el-triunfo'), p_ciudadela, p_tel);
  return v_id;
end; $$;

do $t$
declare
  v_ciudad    uuid;
  v_arb2      uuid;
  v_arb3      uuid;
  v_obra2     uuid;   -- obra de Arbolito 2
  v_obra3     uuid;   -- obra de Arbolito 3
  v_vecino2   uuid;   -- vive en Arbolito 2
  v_vecino2b  uuid;
  v_vecino3   uuid;   -- vive en Arbolito 3
  v_sin_barrio uuid;
  v_r         jsonb;
  v_n         integer;
  v_i         integer;
  v_pct       numeric;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';
  select id into v_arb2 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-2';
  select id into v_arb3 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-3';
  select id into v_obra2 from public.obras where ciudadela_id = v_arb2 and aprobada limit 1;
  select id into v_obra3 from public.obras where ciudadela_id = v_arb3 and aprobada limit 1;

  v_vecino2  := pg_temp.crear_vecino('+593991000001', v_arb2);
  v_vecino2b := pg_temp.crear_vecino('+593991000002', v_arb2);
  v_vecino3  := pg_temp.crear_vecino('+593991000003', v_arb3);
  v_sin_barrio := pg_temp.crear_vecino('+593991000004', null);

  -- A: el camino feliz ------------------------------------------------------
  perform pg_temp.act_as(v_vecino2);
  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('A1 — un vecino puede apoyar una obra de su ciudadela',
    (v_r ->> 'success')::boolean, v_r::text);
  perform pg_temp.chk('A2 — el apoyo queda contado',
    (v_r ->> 'apoyos')::integer = 1, v_r ->> 'apoyos');

  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('A3 — el contador de la obra coincide con la fila creada', v_n = 1, v_n::text);

  select count(*) into v_n from public.votos where obra_id = v_obra2;
  perform pg_temp.chk('A4 — hay exactamente un voto en la tabla', v_n = 1, v_n::text);

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
    insert into public.votos (obra_id, vecino_id, ciudad_id) values (v_obra2, v_vecino2, v_ciudad);
    perform pg_temp.chk('B4 — el índice único impide el voto duplicado', false, 'lo insertó');
  exception when unique_violation then
    perform pg_temp.chk('B4 — el índice único impide el voto duplicado', true, 'unique_violation');
  end;

  -- C: solo en la ciudadela propia. Esta es LA regla del producto -----------
  perform pg_temp.act_as(v_vecino3);
  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('C1 — un vecino de Arbolito 3 NO puede apoyar una obra de Arbolito 2',
    not (v_r ->> 'success')::boolean, v_r::text);
  perform pg_temp.chk('C2 — y el motivo se lo explica claro',
    v_r ->> 'error_code' = 'fuera_de_tu_ciudadela', v_r ->> 'error_code');

  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('C3 — el intento no dejó rastro en el contador', v_n = 1, 'apoyos=' || v_n);

  -- Pero sí puede apoyar lo suyo.
  v_r := public.obra_apoyar(v_obra3);
  perform pg_temp.chk('C4 — ese mismo vecino SÍ apoya una obra de su barrio',
    (v_r ->> 'success')::boolean, v_r::text);

  -- D: quien no eligió barrio todavía ---------------------------------------
  perform pg_temp.act_as(v_sin_barrio);
  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('D1 — sin ciudadela elegida no se puede apoyar',
    v_r ->> 'error_code' = 'falta_ciudadela', v_r ->> 'error_code');

  -- E: sin sesión -------------------------------------------------------------
  perform pg_temp.act_anon();
  v_r := public.obra_apoyar(v_obra2);
  perform pg_temp.chk('E1 — sin sesión no se puede apoyar',
    v_r ->> 'error_code' = 'sin_sesion', v_r ->> 'error_code');

  -- F: obras que no están disponibles ---------------------------------------
  perform pg_temp.act_as(v_vecino2b);
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
  v_r := public.obra_apoyar(v_obra2);
  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('G1 — un segundo vecino suma su apoyo', v_n = 2, 'apoyos=' || v_n);

  v_r := public.obra_quitar_apoyo(v_obra2);
  perform pg_temp.chk('G2 — se puede retirar el apoyo', (v_r ->> 'success')::boolean, v_r::text);
  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('G3 — el contador baja al retirarlo', v_n = 1, 'apoyos=' || v_n);

  v_r := public.obra_quitar_apoyo(v_obra2);
  select apoyos into v_n from public.obras where id = v_obra2;
  perform pg_temp.chk('G4 — retirar dos veces no deja el contador en negativo', v_n = 1, 'apoyos=' || v_n);

  -- H: el porcentaje sobre los vecinos del barrio ----------------------------
  -- Arbolito 2 tiene 2 vecinos registrados y la obra 1 apoyo: 50 %.
  perform pg_temp.act_as(v_vecino2);
  v_r := public.obra_detalle(v_obra2);
  v_pct := (v_r -> 'obra' ->> 'porcentaje_ciudadela')::numeric;
  perform pg_temp.chk('H1 — el porcentaje se calcula sobre los vecinos de ESE barrio',
    v_pct = 50.0, 'porcentaje=' || coalesce(v_pct::text, 'null'));

  perform pg_temp.chk('H2 — el detalle informa cuántos vecinos tiene el barrio',
    (v_r -> 'obra' ->> 'vecinos_ciudadela')::integer = 2,
    v_r -> 'obra' ->> 'vecinos_ciudadela');

  -- Un barrio grande con los mismos apoyos pesa menos: es la corrección que
  -- compensa el voto ilimitado.
  perform pg_temp.chk('H3 — el detalle marca que este vecino ya la apoyó',
    (v_r -> 'obra' ->> 'ya_apoyada')::boolean, v_r -> 'obra' ->> 'ya_apoyada');

  perform pg_temp.act_as(v_vecino3);
  v_r := public.obra_detalle(v_obra2);
  perform pg_temp.chk('H4 — a otro vecino no le aparece como apoyada',
    not (v_r -> 'obra' ->> 'ya_apoyada')::boolean, v_r -> 'obra' ->> 'ya_apoyada');

  -- I: el enlace corto que se comparte por WhatsApp --------------------------
  perform pg_temp.act_anon();
  v_r := public.obra_detalle(null, (select codigo from public.obras where id = v_obra2));
  perform pg_temp.chk('I1 — el código corto abre la obra sin necesidad de sesión',
    (v_r ->> 'success')::boolean and (v_r -> 'obra' ->> 'id')::uuid = v_obra2, v_r ->> 'error_code');

  v_r := public.obra_detalle(null, lower((select codigo from public.obras where id = v_obra2)));
  perform pg_temp.chk('I2 — el código funciona en minúsculas (la gente lo escribe como sea)',
    (v_r ->> 'success')::boolean, v_r ->> 'error_code');

  -- Una obra fusionada redirige en vez de mostrar una página muerta.
  update public.obras set fusionada_en = v_obra3 where id = v_obra2;
  v_r := public.obra_detalle(v_obra2);
  perform pg_temp.chk('I3 — una obra fusionada redirige a su destino',
    v_r ->> 'error_code' = 'obra_fusionada' and (v_r ->> 'destino_id')::uuid = v_obra3,
    v_r::text);
  update public.obras set fusionada_en = null where id = v_obra2;

exception when others then
  perform pg_temp.chk('EXCEPCIÓN no controlada en la suite', false, sqlerrm);
end;
$t$;

select case when pass then '✅ PASS ' else '❌ FALLA' end || ' | ' || test as resultado, detail
  from t_results order by n;

do $$
declare v_fail integer; v_total integer;
begin
  select count(*) filter (where not pass), count(*) into v_fail, v_total from t_results;
  raise notice 'smoke-voto — % en verde, % en rojo de %', v_total - v_fail, v_fail, v_total;
  if v_fail > 0 then
    raise exception 'smoke-voto: % reglas del apoyo rotas', v_fail;
  end if;
end;
$$;

rollback;
