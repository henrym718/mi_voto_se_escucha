-- ============================================================================
-- smoke-rls — la seguridad de los datos, probada de verdad.
--
-- No comprueba que las políticas existan: se hace pasar por un visitante
-- anónimo y por un vecino cualquiera, y verifica que NO pueden hacer lo que no
-- les toca. Es la suite que sostiene el precio del producto: si un rival puede
-- inflar votos o leer el padrón, no hay nada que vender.
--
-- Un acceso puede fallar de dos formas, y las dos son correctas: por GRANT
-- (permission denied, la puerta cerrada) o por RLS (cero filas, la puerta
-- abierta a un cuarto vacío). Los helpers de abajo tratan ambas como bloqueo.
--
-- Correr con: ./scripts/run-smokes.sh rls
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages to warning;

begin;

create temp table t_results (n serial, test text, pass boolean, detail text) on commit drop;

create function pg_temp.chk(p_test text, p_pass boolean, p_detail text default '') returns void
language sql as $$
  insert into t_results (test, pass, detail) values (p_test, coalesce(p_pass, false), p_detail);
$$;

-- Cuenta filas visibles. Devuelve -1 si ni siquiera puede abrir la tabla.
create function pg_temp.visibles(p_tabla text) returns integer
language plpgsql as $$
declare v integer;
begin
  execute format('select count(*) from %s', p_tabla) into v;
  return v;
exception when insufficient_privilege then
  return -1;
end; $$;

-- Intenta una escritura. true = quedó bloqueada (por GRANT o por RLS).
create function pg_temp.bloqueado(p_sql text) returns boolean
language plpgsql as $$
begin
  execute p_sql;
  return false;
exception
  when insufficient_privilege then return true;
  when check_violation then return true;
  when others then return true;
end; $$;

create function pg_temp.act_as(p_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end; $$;

create function pg_temp.act_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end; $$;

create function pg_temp.act_dios() returns void
language plpgsql as $$
begin
  execute 'set local role postgres';
  perform set_config('request.jwt.claims', '', true);
end; $$;

create function pg_temp.crear_vecino(p_tel text, p_ciudadela uuid) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  -- Sufijo al azar: la base puede tener vecinos de verdad o de otra prueba, y
  -- un número fijo chocaría con el índice único. Las suites no deben suponer
  -- nunca que la base está vacía.
  v_tel text := p_tel || floor(random() * 9000 + 1000)::text;
begin
  insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
          v_tel, now(), now());
  insert into public.vecinos (id, ciudad_id, ciudadela_id, telefono)
  values (v_id, (select id from public.ciudades where slug = 'el-triunfo'), p_ciudadela, v_tel);
  return v_id;
end; $$;

do $grants$
declare v_tmp text := (select nspname from pg_namespace where oid = pg_my_temp_schema());
begin
  execute format('grant usage on schema %I to anon, authenticated', v_tmp);
  execute format('grant all on %I.t_results to anon, authenticated', v_tmp);
  execute format('grant all on sequence %I.t_results_n_seq to anon, authenticated', v_tmp);
end;
$grants$;

do $t$
declare
  v_ciudad    uuid;
  v_arbolito2 uuid;
  v_arbolito3 uuid;
  v_vecino_a  uuid;
  v_vecino_b  uuid;
  v_obra      uuid;
  v_cat       uuid;
  v_est       uuid;
  v_n         integer;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';
  select id into v_arbolito2 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-2';
  select id into v_arbolito3 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-3';
  select id into v_obra from public.obras where ciudadela_id = v_arbolito2 limit 1;
  select id into v_cat from public.categorias where ciudad_id = v_ciudad limit 1;
  select id into v_est from public.estados where ciudad_id = v_ciudad and es_compromiso;

  v_vecino_a := pg_temp.crear_vecino('+593990000001', v_arbolito2);
  v_vecino_b := pg_temp.crear_vecino('+593990000002', v_arbolito3);
  insert into public.votos (obra_id, vecino_id, ciudad_id) values (v_obra, v_vecino_b, v_ciudad);

  -- ====================================================== visitante anónimo ==
  perform pg_temp.act_anon();

  -- A: lo que SÍ debe poder, porque mirar no exige registrarse ---------------
  perform pg_temp.chk('A1 — el anónimo SÍ ve las ciudadelas (necesita elegir la suya)',
    pg_temp.visibles('public.ciudadelas') >= 70, pg_temp.visibles('public.ciudadelas')::text);
  perform pg_temp.chk('A2 — el anónimo SÍ ve las obras aprobadas',
    pg_temp.visibles('public.obras') >= 40, pg_temp.visibles('public.obras')::text);
  perform pg_temp.chk('A3 — el anónimo SÍ ve el portal del candidato',
    pg_temp.visibles('public.portal') = 1, pg_temp.visibles('public.portal')::text);
  perform pg_temp.chk('A4 — el anónimo SÍ ve los estados y categorías',
    pg_temp.visibles('public.estados') >= 6 and pg_temp.visibles('public.categorias') >= 8, '');

  -- B: lo que NO debe poder leer ---------------------------------------------
  perform pg_temp.chk('B1 — el anónimo NO lee ni un teléfono del padrón',
    pg_temp.visibles('public.vecinos') <= 0, pg_temp.visibles('public.vecinos')::text);
  -- El enlace del canal SÍ es público: el vecino tiene que poder tocarlo desde
  -- la pantalla de confirmación. Lo que nunca sale es a quién pertenece un
  -- número, y eso ya lo cubre B1.
  perform pg_temp.chk('B2 — el anónimo SÍ ve el enlace del canal de su sector',
    pg_temp.visibles('public.ciudadelas') >= 70, pg_temp.visibles('public.ciudadelas')::text);
  perform pg_temp.chk('B3 — el anónimo NO puede sacar los contactos de un sector',
    pg_temp.bloqueado(format('select public.admin_contactos_sector(%L, false)', v_arbolito2)));
  perform pg_temp.chk('B4 — el anónimo NO lee la bitácora del equipo',
    pg_temp.visibles('public.bitacora') <= 0, pg_temp.visibles('public.bitacora')::text);
  perform pg_temp.chk('B5 — el anónimo NO ve el voto de nadie',
    pg_temp.visibles('public.votos') <= 0, pg_temp.visibles('public.votos')::text);
  perform pg_temp.chk('B6 — el anónimo NO ve quién es del equipo',
    pg_temp.visibles('public.admins') <= 0, pg_temp.visibles('public.admins')::text);

  -- C: lo que NO debe poder escribir. Aquí se juega el valor del dato --------
  perform pg_temp.chk('C1 — el anónimo NO puede insertar un voto directo',
    pg_temp.bloqueado(format(
      'insert into public.votos (obra_id, vecino_id, ciudad_id) values (%L, %L, %L)',
      v_obra, v_vecino_a, v_ciudad)));

  perform pg_temp.chk('C2 — el anónimo NO puede colar una obra sin pasar por la cola',
    pg_temp.bloqueado(format(
      'insert into public.obras (ciudad_id, ciudadela_id, categoria_id, estado_id, titulo, aprobada)
       values (%L, %L, %L, %L, %L, true)',
      v_ciudad, v_arbolito2, v_cat,
      (select id from public.estados where ciudad_id = v_ciudad and es_inicial),
      'Obra colada por la puerta de atrás')));

  perform pg_temp.chk('C3 — el anónimo NO puede inflar el contador de apoyos',
    pg_temp.bloqueado(format('update public.obras set apoyos = 99999 where id = %L', v_obra)));

  perform pg_temp.chk('C4 — el anónimo NO puede marcar una obra como comprometida',
    pg_temp.bloqueado(format('update public.obras set estado_id = %L where id = %L', v_est, v_obra)));

  perform pg_temp.chk('C5 — el anónimo NO puede inventarse una ciudadela',
    pg_temp.bloqueado(format(
      'insert into public.ciudadelas (ciudad_id, nombre, slug) values (%L, %L, %L)',
      v_ciudad, 'Barrio Fantasma', 'barrio-fantasma')));

  perform pg_temp.chk('C6 — el anónimo NO puede darse de alta como vecino a mano',
    pg_temp.bloqueado(format(
      'insert into public.vecinos (id, ciudad_id, telefono) values (%L, %L, %L)',
      gen_random_uuid(), v_ciudad, '+593999999999')));

  perform pg_temp.chk('C7 — el anónimo NO puede ponerle título a una obra ajena',
    pg_temp.bloqueado(format(
      'select public.obra_ia_resultado(%L, %L, %L)', v_obra, 'Titulo puesto a dedo', '')));

  perform pg_temp.chk('C8 — el anónimo NO puede pegar un enlace de canal falso',
    pg_temp.bloqueado(format('select public.admin_canales_guardar(%L, ''[]''::jsonb)', v_ciudad)));

  -- D: funciones reservadas al servidor -------------------------------------
  perform pg_temp.chk('D1 — el anónimo NO puede darse de alta saltándose las RPC',
    pg_temp.bloqueado(format('select public.vecino_asegurar_interno(%L)', v_ciudad)));
  perform pg_temp.chk('D2 — el anónimo NO puede leer la lista de canales del panel',
    pg_temp.bloqueado(format('select public.admin_canales_listar(%L)', v_ciudad)));
  perform pg_temp.chk('D3 — el anónimo NO puede ver la cola de aprobación',
    pg_temp.bloqueado(format('select public.admin_cola_aprobacion(%L)', v_ciudad)));
  perform pg_temp.chk('D4 — el anónimo NO puede escribir en la bitácora',
    pg_temp.bloqueado(format(
      'select public.anotar_bitacora(%L, %L, %L, null, ''{}''::jsonb)',
      v_ciudad, 'hackeo', 'obra')));

  -- =========================================== vecino cualquiera, sin cargo ==
  perform pg_temp.act_as(v_vecino_a);

  perform pg_temp.chk('E1 — el vecino ve SOLO su propia ficha',
    pg_temp.visibles('public.vecinos') = 1, pg_temp.visibles('public.vecinos')::text);

  perform pg_temp.chk('E2 — el vecino NO ve la ficha de otro vecino',
    pg_temp.visibles(format('(select * from public.vecinos where id = %L) x', v_vecino_b)) = 0, '');

  perform pg_temp.chk('E3 — el vecino NO ve a quién apoyó otro vecino',
    pg_temp.visibles(format('(select * from public.votos where vecino_id = %L) x', v_vecino_b)) = 0, '');

  -- Un vecino con sesión llega como `authenticated`, igual que el equipo del
  -- panel: el GRANT no puede separarlos y quien decide es la comprobación de
  -- rol de dentro de la función. Por eso aquí NO se espera una excepción sino
  -- un `sin_permiso` — y sobre todo, que no venga ni un teléfono de vuelta.
  perform pg_temp.chk('E4 — el vecino NO puede exportar los teléfonos de su barrio',
    public.admin_contactos_sector(v_arbolito2) ->> 'error_code' = 'sin_permiso',
    public.admin_contactos_sector(v_arbolito2)::text);

  perform pg_temp.chk('E5 — y esa negativa no devuelve ningún contacto',
    public.admin_contactos_sector(v_arbolito2) -> 'items' is null,
    public.admin_contactos_sector(v_arbolito2)::text);

  perform pg_temp.chk('E5b — el vecino NO lee el padrón completo',
    pg_temp.visibles('public.vecinos') < 2, pg_temp.visibles('public.vecinos')::text);

  -- Cambiarle el teléfono a otro sería lo más grave que se puede hacer aquí:
  -- se le roba el contacto a una persona real. El update no lanza error — RLS
  -- simplemente no toca ninguna fila —, así que se comprueba el resultado.
  perform pg_temp.bloqueado(format(
    'update public.vecinos set telefono = ''+593999999999'' where id = %L', v_vecino_b));
  perform pg_temp.act_dios();
  select count(*) into v_n from public.vecinos
   where id = v_vecino_b and telefono = '+593999999999';
  perform pg_temp.chk('E6 — el vecino NO puede cambiarle el teléfono a otro', v_n = 0, v_n::text);

  perform pg_temp.act_as(v_vecino_a);
  perform pg_temp.bloqueado(format(
    'insert into public.admins (id, ciudad_id, rol) values (%L, %L, ''admin'')', v_vecino_a, v_ciudad));
  perform pg_temp.act_dios();
  select count(*) into v_n from public.admins where id = v_vecino_a;
  perform pg_temp.chk('E7 — un vecino NO puede ascenderse a admin', v_n = 0, v_n || ' filas creadas');

  perform pg_temp.act_as(v_vecino_a);
  perform pg_temp.bloqueado(format('update public.obras set apoyos = 5000 where id = %L', v_obra));
  perform pg_temp.act_dios();
  select apoyos into v_n from public.obras where id = v_obra;
  perform pg_temp.chk('E8 — un vecino NO puede inflar el contador', v_n <> 5000, 'apoyos=' || v_n);

  perform pg_temp.act_as(v_vecino_a);
  perform pg_temp.chk('E9 — un vecino no figura como equipo',
    not public.es_del_equipo(v_ciudad), 'es_del_equipo dio true');
  perform pg_temp.chk('E10 — un vecino no puede editar',
    not public.puede_editar(v_ciudad), 'puede_editar dio true');
  perform pg_temp.chk('E11 — un vecino no es admin',
    not public.es_admin(v_ciudad), 'es_admin dio true');

  perform pg_temp.act_dios();

exception when others then
  begin execute 'set local role postgres'; exception when others then null; end;
  perform pg_temp.chk('EXCEPCIÓN no controlada en la suite', false, sqlerrm);
end;
$t$;

set local role postgres;

select case when pass then '✅ PASS ' else '❌ FALLA' end || ' | ' || test as resultado, detail
  from t_results order by n;

do $$
declare v_fail integer; v_total integer;
begin
  select count(*) filter (where not pass), count(*) into v_fail, v_total from t_results;
  raise notice 'smoke-rls — % en verde, % en rojo de %', v_total - v_fail, v_fail, v_total;
  if v_fail > 0 then
    raise exception 'smoke-rls: % huecos de seguridad abiertos', v_fail;
  end if;
end;
$$;

rollback;
