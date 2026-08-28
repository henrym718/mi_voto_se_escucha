-- ============================================================================
-- smoke-orden — que la lista no se baraje sola.
--
-- El bug que originó esta suite: al apoyar una obra, la pantalla entera se
-- reacomodaba. Obras que nadie tocó cambiaban de puesto, y quien apoyaba la #13
-- veía moverse la #12 y creía que su apoyo se había ido a la obra equivocada.
--
-- La causa no era el voto sino el ORDEN: `obras_listar` desempataba solo por
-- apoyos, y en una ciudad nueva casi todas las obras están empatadas. Postgres
-- devuelve las filas empatadas en el orden que le convenga a cada plan, así que
-- dos consultas idénticas daban dos listas distintas.
--
-- Lo que se prueba aquí es una sola idea, en tres formas: la lista solo cambia
-- cuando cambian los apoyos.
--
-- Correr con: ./scripts/run-smokes.sh orden
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

-- Los ids del listado, en el orden en que salieron.
create function pg_temp.orden_listado(p_ciudad text, p_limite integer default 30) returns uuid[]
language sql as $$
  select array_agg((e.i ->> 'id')::uuid order by e.ord)
    from jsonb_array_elements(
           public.obras_listar(p_ciudad_slug := p_ciudad, p_orden := 'apoyos', p_limite := p_limite)
           -> 'items'
         ) with ordinality as e(i, ord);
$$;

do $t$
declare
  v_ciudad   uuid;
  v_sesion   uuid;
  v_antes    uuid[];
  v_otra     uuid[];
  v_despues  uuid[];
  v_esperado uuid[];
  v_elegida  uuid;
  v_r        jsonb;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';

  -- Se parte del peor caso, que además es el caso real de una ciudad que
  -- arranca: TODAS las obras empatadas a cero. Ahí es donde el desempate es lo
  -- único que decide el orden. Vive dentro del rollback, así que no toca nada.
  delete from public.votos;
  delete from public.vecinos;
  update public.obras set apoyos = 0 where ciudad_id = v_ciudad;

  v_sesion := pg_temp.crear_sesion();
  perform pg_temp.act_as(v_sesion);

  v_antes := pg_temp.orden_listado('el-triunfo');
  perform pg_temp.chk('A0 — hay obras suficientes para que el orden signifique algo',
    coalesce(array_length(v_antes, 1), 0) >= 5,
    coalesce(array_length(v_antes, 1), 0)::text || ' obras');

  -- A: la misma pregunta, la misma respuesta -----------------------------------
  v_otra := pg_temp.orden_listado('el-triunfo');
  perform pg_temp.chk('A1 — dos llamadas iguales devuelven el mismo orden',
    v_antes = v_otra, 'sin apoyos de por medio, la lista no puede cambiar');

  -- B: el orden es el que dice la regla, no el que salga -----------------------
  select array_agg(t.id order by t.n) into v_esperado
    from (
      select o.id,
             row_number() over (order by o.apoyos desc, o.creada_en desc, o.id) as n
        from public.obras o
       where o.ciudad_id = v_ciudad
         and o.aprobada
         and o.fusionada_en is null
         and o.rechazada_en is null
    ) t
   where t.n <= 30;

  perform pg_temp.chk('B1 — el orden es apoyos desc, luego la más nueva, luego el id',
    v_antes = v_esperado, 'el desempate tiene que ser total: si no, es aleatorio');

  -- C: un apoyo mueve UNA tarjeta, no la pantalla ------------------------------
  v_elegida := v_antes[5];
  v_r := public.obra_apoyar(v_elegida);
  perform pg_temp.chk('C0 — el apoyo se registra', (v_r ->> 'success')::boolean, v_r::text);

  v_despues := pg_temp.orden_listado('el-triunfo');

  perform pg_temp.chk('C1 — la obra apoyada queda primera',
    v_despues[1] = v_elegida, 'es la única con un apoyo');

  -- El corazón de la suite: quitando la que subió, la lista es exactamente la
  -- de antes. Ninguna obra que nadie tocó cambió de sitio.
  perform pg_temp.chk('C2 — ninguna otra obra se movió',
    (select array_agg(x order by n)
       from unnest(v_despues) with ordinality as a(x, n)
      where x <> v_elegida)
    =
    (select array_agg(x order by n)
       from unnest(v_antes) with ordinality as b(x, n)
      where x <> v_elegida),
    'si esto falla, al vecino le parece que apoyó otra obra');

  -- D: y al quitarlo, todo vuelve a donde estaba ------------------------------
  perform public.obra_quitar_apoyo(v_elegida);
  perform pg_temp.chk('D1 — al retirar el apoyo la lista vuelve a ser la de antes',
    pg_temp.orden_listado('el-triunfo') = v_antes, 'el orden es reversible');

exception when others then
  perform pg_temp.chk('smoke-orden — excepción', false, sqlerrm);
end $t$;

select case when pass then '✅ PASS  ' else '❌ FALLA ' end || ' | ' || test as resultado, detail
  from t_results order by n;

do $$
declare v_fail int;
begin
  select count(*) into v_fail from t_results where not pass;
  if v_fail > 0 then raise exception 'smoke-orden: % en rojo', v_fail; end if;
end $$;

rollback;
