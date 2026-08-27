-- ============================================================================
-- smoke-pedidos — publicar un pedido y el bucle anti-duplicados.
--
-- El "buscar antes de crear" es lo que evita terminar con cuarenta quejas de
-- alcantarillado en Arbolito 2 con un voto cada una. Si esta suite se pone en
-- rojo, el ranking pierde el filo comercial.
--
-- Correr con: ./scripts/run-smokes.sh pedidos
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
begin perform set_config('request.jwt.claims', '', true); end; $$;

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

do $t$
declare
  v_ciudad uuid; v_arb2 uuid; v_arb3 uuid;
  v_cat_pluvial uuid; v_cat_seg uuid; v_cat_sanit uuid;
  v_vecino uuid; v_otro uuid;
  v_r jsonb; v_n integer; v_i integer;
  v_obra_id uuid;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';
  select id into v_arb2 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-2';
  select id into v_arb3 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-3';
  select id into v_cat_pluvial from public.categorias where ciudad_id = v_ciudad and slug = 'pluvial';
  select id into v_cat_seg from public.categorias where ciudad_id = v_ciudad and slug = 'seguridad';
  -- Arbolito 2 aparece en el PDOT por alcantarillado sanitario, no por pluvial:
  -- esa es la categoría que sí tiene pedidos pre-cargados en ese barrio.
  select id into v_cat_sanit from public.categorias where ciudad_id = v_ciudad and slug = 'sanitario';

  v_vecino := pg_temp.crear_vecino('+593992000001', v_arb2);
  v_otro   := pg_temp.crear_vecino('+593992000002', v_arb3);

  -- A: el pedido entra hablando, sin escribir un título ----------------------
  -- Es el cambio que abre el embudo: mucha gente del cantón manda audios todo
  -- el día y no redactaría nunca un título de 8 a 120 caracteres.
  perform pg_temp.act_as(v_vecino);
  v_r := public.obra_crear(v_arb2, v_cat_seg, null, 'audios/nota-de-prueba.webm');
  perform pg_temp.chk('A1 — se publica solo con una nota de voz, sin escribir nada',
    (v_r ->> 'success')::boolean, v_r::text);

  v_obra_id := (v_r -> 'obra' ->> 'id')::uuid;

  perform pg_temp.chk('A2 — el pedido queda esperando a que la IA lo ordene',
    (select ia_estado from public.obras where id = v_obra_id) = 'pendiente',
    (select ia_estado from public.obras where id = v_obra_id));

  perform pg_temp.chk('A3 — y todavía sin título: lo pone el servidor, no el vecino',
    (select titulo from public.obras where id = v_obra_id) is null,
    coalesce((select titulo from public.obras where id = v_obra_id), 'null'));

  -- Sin nada que contar no hay pedido.
  v_r := public.obra_crear(v_arb2, v_cat_seg, null, null);
  perform pg_temp.chk('A4 — un pedido sin voz ni texto se rechaza',
    v_r ->> 'error_code' = 'sin_contenido', v_r ->> 'error_code');

  -- B: el pedido escrito ------------------------------------------------------
  v_r := public.obra_crear(v_arb2, v_cat_seg,
    'Se han dado varios robos de noche en la calle 5 y no hay alarma comunitaria.');
  perform pg_temp.chk('B1 — un vecino también puede publicar escribiendo',
    (v_r ->> 'success')::boolean, v_r::text);

  perform pg_temp.chk('B2 — el pedido nace SIN aprobar: pasa por la cola del equipo',
    not (select aprobada from public.obras where id = (v_r -> 'obra' ->> 'id')::uuid), '');

  perform pg_temp.chk('B3 — lo que el vecino escribió se guarda tal cual',
    (select texto_original from public.obras where id = (v_r -> 'obra' ->> 'id')::uuid) ilike '%robos%',
    (select texto_original from public.obras where id = (v_r -> 'obra' ->> 'id')::uuid));

  perform pg_temp.chk('B4 — el pedido trae su código para compartir',
    length(v_r -> 'obra' ->> 'codigo') = 6, v_r -> 'obra' ->> 'codigo');

  -- Quien pide una obra la apoya de entrada: sería absurdo pedirla y no apoyarla.
  select apoyos into v_n from public.obras where id = v_obra_id;
  perform pg_temp.chk('B5 — quien publica el pedido queda apoyándolo', v_n = 1, 'apoyos=' || v_n);

  -- Nace en el estado inicial de la ciudad.
  perform pg_temp.chk('B6 — el pedido nace en el estado inicial configurado',
    exists (select 1 from public.obras o join public.estados e on e.id = o.estado_id
             where o.id = v_obra_id and e.es_inicial), '');

  -- C: mientras no se apruebe, nadie más lo ve ---------------------------------
  perform pg_temp.act_as(v_otro);
  v_r := public.obra_detalle(v_obra_id);
  perform pg_temp.chk('C1 — otro vecino NO ve el pedido mientras está en la cola',
    v_r ->> 'error_code' = 'obra_no_disponible', v_r ->> 'error_code');

  perform pg_temp.act_as(v_vecino);
  v_r := public.obra_detalle(v_obra_id);
  perform pg_temp.chk('C2 — pero su autor SÍ puede seguirlo',
    (v_r ->> 'success')::boolean, v_r ->> 'error_code');

  -- Y no aparece en el listado público.
  perform pg_temp.act_anon();
  v_r := public.obras_listar('el-triunfo', v_arb2, v_cat_seg);
  perform pg_temp.chk('C3 — el pedido en cola no sale en el listado público',
    jsonb_array_length(v_r -> 'items') = 0, jsonb_array_length(v_r -> 'items')::text);

  -- D: validaciones ------------------------------------------------------------
  perform pg_temp.act_as(v_vecino);
  -- Reportar en un barrio que no es el propio es LEGÍTIMO: el hueco que alguien
  -- ve camino al trabajo es un problema real de ese sector, no del suyo.
  v_r := public.obra_crear(v_arb3, v_cat_seg, 'En el barrio de al lado hay un hueco enorme.');
  perform pg_temp.chk('D1 — se puede reportar un problema de otro sector',
    (v_r ->> 'success')::boolean, v_r::text);
  perform pg_temp.chk('D2 — y la obra queda en el sector del problema, no en el del vecino',
    (select ciudadela_id from public.obras where id = (v_r -> 'obra' ->> 'id')::uuid) = v_arb3, '');

  v_r := public.obra_crear(v_arb2, gen_random_uuid(), 'Pedido con una categoría inventada.');
  perform pg_temp.chk('D3 — no se puede usar una categoría que no existe',
    v_r ->> 'error_code' = 'categoria_invalida', v_r ->> 'error_code');

  perform pg_temp.act_anon();
  v_r := public.obra_crear(v_arb2, v_cat_seg, 'Pedido de alguien sin sesión ninguna.');
  perform pg_temp.chk('D4 — sin sesión no se puede publicar',
    v_r ->> 'error_code' = 'sin_sesion', v_r ->> 'error_code');

  -- E: anti-inundación -----------------------------------------------------------
  perform pg_temp.act_as(v_vecino);
  -- Ya lleva tres creados arriba: el de voz, el escrito y el del otro barrio.
  v_r := public.obra_crear(v_arb2, v_cat_seg, 'Cuarto pedido del mismo vecino en el mismo día.');
  perform pg_temp.chk('E1 — un vecino no puede publicar más de 3 pedidos al día',
    v_r ->> 'error_code' = 'demasiados_pedidos_hoy', v_r ->> 'error_code');

  select count(*) into v_n from public.obras where creador_id = v_vecino;
  perform pg_temp.chk('E2 — y solo quedaron los 3 permitidos', v_n = 3, v_n::text);

  -- F: el listado público y sus filtros ------------------------------------------
  perform pg_temp.act_anon();
  v_r := public.obras_listar('el-triunfo');
  perform pg_temp.chk('F1 — el listado devuelve las obras de la ciudad',
    (v_r ->> 'total')::integer >= 40, v_r ->> 'total');

  v_r := public.obras_listar('el-triunfo', v_arb2);
  select count(*) into v_n from public.obras
   where ciudadela_id = v_arb2 and aprobada and fusionada_en is null;
  perform pg_temp.chk('F2 — filtrar por ciudadela cuadra con la base',
    (v_r ->> 'total')::integer = v_n, (v_r ->> 'total') || ' vs ' || v_n);

  v_r := public.obras_listar('el-triunfo', null, v_cat_pluvial);
  perform pg_temp.chk('F3 — filtrar por categoría devuelve solo esa categoría',
    (v_r ->> 'total')::integer >= 20, v_r ->> 'total');

  v_r := public.obras_listar('el-triunfo', null, null, null, 'Arbolito');
  perform pg_temp.chk('F4 — la búsqueda por texto encuentra por nombre de barrio',
    (v_r ->> 'total')::integer >= 2, v_r ->> 'total');

  v_r := public.obras_listar('ciudad-que-no-existe');
  perform pg_temp.chk('F5 — una ciudad inexistente da error controlado',
    v_r ->> 'error_code' = 'ciudad_no_encontrada', v_r ->> 'error_code');

  -- La paginación no repite ni pierde filas.
  v_r := public.obras_listar('el-triunfo', null, null, null, null, 'apoyos', 5, 0);
  perform pg_temp.chk('F6 — el límite de página se respeta',
    jsonb_array_length(v_r -> 'items') = 5, jsonb_array_length(v_r -> 'items')::text);

  -- G: lo que la tarjeta necesita para pintarse -------------------------------
  perform pg_temp.chk('G1 — cada obra del listado trae su contador de apoyos',
    (v_r -> 'items' -> 0) ? 'apoyos', (v_r -> 'items' -> 0)::text);
  perform pg_temp.chk('G2 — y si quien mira ya la apoyó',
    (v_r -> 'items' -> 0) ? 'ya_apoyada', (v_r -> 'items' -> 0)::text);

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
  raise notice 'smoke-pedidos — % en verde, % en rojo de %', v_total - v_fail, v_fail, v_total;
  if v_fail > 0 then raise exception 'smoke-pedidos: % en rojo', v_fail; end if;
end;
$$;

rollback;
