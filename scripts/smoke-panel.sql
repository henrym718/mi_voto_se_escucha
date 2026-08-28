-- ============================================================================
-- smoke-panel — el tablero del equipo de campaña.
--
-- Incluye la separación de roles, que es lo que permite darle acceso al
-- candidato sin miedo: entra a ver sus métricas desde el celular y no puede
-- romper nada aunque toque donde no debe.
--
-- Correr con: ./scripts/run-smokes.sh panel
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

create function pg_temp.crear_usuario() returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', now(), now());
  return v_id;
end; $$;

create function pg_temp.crear_admin(p_rol text) returns uuid
language plpgsql as $$
declare v_id uuid := pg_temp.crear_usuario();
begin
  insert into public.admins (id, ciudad_id, rol, nombre)
  values (v_id, (select id from public.ciudades where slug = 'el-triunfo'), p_rol, 'Prueba ' || p_rol);
  return v_id;
end; $$;

create function pg_temp.crear_vecino(p_tel text, p_ciudadela uuid) returns uuid
language plpgsql as $$
declare
  v_id uuid := pg_temp.crear_usuario();
  -- Ver la nota de arriba: sufijo al azar para no chocar con datos reales.
  v_tel text := p_tel || floor(random() * 9000 + 1000)::text;
begin
  update auth.users set phone = v_tel where id = v_id;
  insert into public.vecinos (id, ciudad_id, ciudadela_id, telefono)
  values (v_id, (select id from public.ciudades where slug = 'el-triunfo'), p_ciudadela, v_tel);
  return v_id;
end; $$;

do $t$
declare
  v_ciudad uuid; v_arb2 uuid;
  v_admin uuid; v_editor uuid; v_candidato uuid; v_intruso uuid;
  v_vecino1 uuid; v_vecino2 uuid; v_vecino3 uuid;
  v_obra uuid; v_obra_b uuid; v_obra_cola uuid;
  v_est_comprometida uuid; v_est_visitada uuid;
  v_cat uuid;
  v_r jsonb; v_n integer;
  -- Puntos de partida, no cifras absolutas: la obra elegida puede traer ya
  -- avances de antes (los datos de demostración dejan dieciséis), y una prueba
  -- que cuente desde cero se pone roja por algo que no rompió nada.
  v_previas integer; v_previas_media integer;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';
  select id into v_arb2 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-2';
  select id into v_cat from public.categorias where ciudad_id = v_ciudad and slug = 'seguridad';
  select id into v_est_comprometida from public.estados where ciudad_id = v_ciudad and slug = 'comprometida';
  select id into v_est_visitada from public.estados where ciudad_id = v_ciudad and slug = 'visitada';

  -- Esta suite cuenta apoyos y filas de la cola, así que necesita partir de
  -- un estado conocido. Puede permitirse limpiarlo porque toda la suite vive
  -- dentro de una transacción que termina en rollback: la base queda igual que
  -- estaba. Sin esto, correr las pruebas sobre una base con vecinos reales
  -- (staging, o después de una prueba de punta a punta) las pondría en rojo
  -- por datos ajenos, no por errores.
  delete from public.votos;
  delete from public.vecinos;


  v_admin     := pg_temp.crear_admin('admin');
  v_editor    := pg_temp.crear_admin('editor');
  v_candidato := pg_temp.crear_admin('candidato');
  v_intruso   := pg_temp.crear_usuario();

  v_vecino1 := pg_temp.crear_vecino('+593993000001', v_arb2);
  v_vecino2 := pg_temp.crear_vecino('+593993000002', v_arb2);
  v_vecino3 := pg_temp.crear_vecino('+593993000003', v_arb2);

  select id into v_obra from public.obras where ciudadela_id = v_arb2 and aprobada limit 1;
  select id into v_obra_b from public.obras where ciudadela_id = v_arb2 and aprobada and id <> v_obra limit 1;

  -- Escenario de la fusión: vecino2 apoya las DOS obras (no debe contar doble),
  -- vecino3 apoya solo la que va a ser absorbida (su apoyo sí debe migrar).
  insert into public.votos (obra_id, vecino_id, ciudad_id) values (v_obra, v_vecino1, v_ciudad);
  insert into public.votos (obra_id, vecino_id, ciudad_id) values (v_obra, v_vecino2, v_ciudad);
  insert into public.votos (obra_id, vecino_id, ciudad_id) values (v_obra_b, v_vecino2, v_ciudad);
  insert into public.votos (obra_id, vecino_id, ciudad_id) values (v_obra_b, v_vecino3, v_ciudad);

  -- A: quién es quién ---------------------------------------------------------
  perform pg_temp.act_as(v_admin);
  perform pg_temp.chk('A1 — el admin puede editar', public.puede_editar(v_ciudad));
  perform pg_temp.chk('A2 — el admin es admin', public.es_admin(v_ciudad));

  perform pg_temp.act_as(v_editor);
  perform pg_temp.chk('A3 — el editor puede editar', public.puede_editar(v_ciudad));
  perform pg_temp.chk('A4 — pero el editor NO es admin', not public.es_admin(v_ciudad));

  perform pg_temp.act_as(v_candidato);
  perform pg_temp.chk('A5 — el candidato es del equipo', public.es_del_equipo(v_ciudad));
  perform pg_temp.chk('A6 — el candidato NO puede editar (es solo lectura)',
    not public.puede_editar(v_ciudad));

  perform pg_temp.act_as(v_intruso);
  perform pg_temp.chk('A7 — alguien de fuera no es del equipo', not public.es_del_equipo(v_ciudad));
  perform pg_temp.chk('A8 — alguien de fuera no puede editar', not public.puede_editar(v_ciudad));

  -- B: el tablero (kanban) -----------------------------------------------------
  perform pg_temp.act_as(v_editor);
  v_r := public.admin_tablero(v_ciudad);
  perform pg_temp.chk('B1 — el tablero devuelve una columna por estado configurado',
    jsonb_array_length(v_r -> 'columnas') = 6, jsonb_array_length(v_r -> 'columnas')::text);

  perform pg_temp.chk('B2 — cada columna trae su color para pintarla',
    (v_r -> 'columnas' -> 0) ? 'color', (v_r -> 'columnas' -> 0)::text);

  perform pg_temp.chk('B3 — cada tarjeta muestra su sector y su contador',
    (v_r -> 'columnas' -> 0 -> 'obras' -> 0) ? 'ciudadela'
    and (v_r -> 'columnas' -> 0 -> 'obras' -> 0) ? 'apoyos', '');

  perform pg_temp.chk('B4 — cada tarjeta avisa cuántos días lleva sin moverse',
    (v_r -> 'columnas' -> 0 -> 'obras' -> 0) ? 'dias_sin_cambio', '');

  -- El candidato puede mirar el tablero, y eso está bien.
  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_tablero(v_ciudad);
  perform pg_temp.chk('B5 — el candidato SÍ puede ver el tablero',
    (v_r ->> 'success')::boolean, v_r ->> 'error_code');

  perform pg_temp.act_as(v_intruso);
  v_r := public.admin_tablero(v_ciudad);
  perform pg_temp.chk('B6 — alguien de fuera NO ve el tablero',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  -- C: mover una obra de columna ------------------------------------------------
  perform pg_temp.act_as(v_editor);
  select count(*) into v_previas from public.publicaciones where obra_id = v_obra;
  select count(*) into v_previas_media from public.publicaciones
   where obra_id = v_obra and jsonb_array_length(media) = 1;
  v_r := public.admin_obra_cambiar_estado(v_obra, v_est_visitada,
           'El candidato estuvo el sábado con los vecinos.',
           '[{"tipo":"foto","url":"https://ejemplo/1.jpg"}]'::jsonb);
  perform pg_temp.chk('C1 — el editor puede mover una obra de estado',
    (v_r ->> 'success')::boolean, v_r::text);

  perform pg_temp.chk('C2 — el cambio devuelve el estado nuevo para pintarlo',
    v_r -> 'estado' ->> 'nombre' is not null, (v_r -> 'estado')::text);

  select count(*) into v_n from public.publicaciones where obra_id = v_obra;
  perform pg_temp.chk('C3 — queda una entrada nueva en la línea de tiempo pública',
    v_n = v_previas + 1, v_n || ' vs ' || v_previas);

  select count(*) into v_n from public.publicaciones
   where obra_id = v_obra and jsonb_array_length(media) = 1;
  perform pg_temp.chk('C4 — la foto adjunta viaja con la publicación',
    v_n = v_previas_media + 1, v_n || ' vs ' || v_previas_media);

  -- El avance se cuenta en la página de la obra, que es gratis, y no por un
  -- WhatsApp por persona, que a mil vecinos cuesta más que la propia campaña.
  select count(*) into v_n from public.publicaciones
   where obra_id = v_obra and texto ilike '%sábado%';
  perform pg_temp.chk('C5 — el texto del avance queda visible para quien apoyó',
    v_n = 1, v_n::text);

  perform pg_temp.act_anon();
  v_r := public.obra_detalle(v_obra);
  perform pg_temp.chk('C6 — y cualquiera lo ve en la línea de tiempo de la obra',
    jsonb_array_length(v_r -> 'obra' -> 'linea_tiempo') >= 1,
    jsonb_array_length(v_r -> 'obra' -> 'linea_tiempo')::text);
  perform pg_temp.act_as(v_editor);

  select count(*) into v_n from public.bitacora where entidad_id = v_obra and accion = 'cambio_estado';
  perform pg_temp.chk('C7 — el cambio queda registrado en la bitácora', v_n = 1, v_n::text);

  -- El candidato NO puede mover nada.
  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_obra_cambiar_estado(v_obra, v_est_comprometida, 'Intento del candidato');
  perform pg_temp.chk('C8 — el candidato NO puede cambiar estados',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  perform pg_temp.act_as(v_intruso);
  v_r := public.admin_obra_cambiar_estado(v_obra, v_est_comprometida, 'Intento de un extraño');
  perform pg_temp.chk('C9 — alguien de fuera NO puede cambiar estados',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  -- Un estado de otra ciudad no vale.
  perform pg_temp.act_as(v_editor);
  v_r := public.admin_obra_cambiar_estado(v_obra, gen_random_uuid(), 'Estado inventado');
  perform pg_temp.chk('C10 — un estado que no es de esta ciudad se rechaza',
    v_r ->> 'error_code' = 'estado_invalido', v_r ->> 'error_code');

  -- Mover dos veces deja dos entradas: la línea de tiempo es un historial, no
  -- un estado que se sobreescribe.
  v_r := public.admin_obra_cambiar_estado(v_obra, v_est_comprometida, 'Entra al plan de obras.');
  select count(*) into v_n from public.publicaciones where obra_id = v_obra;
  perform pg_temp.chk('C11 — cada movimiento suma una entrada al historial',
    v_n = v_previas + 2, v_n || ' vs ' || v_previas);

  -- D: la cola de aprobación ----------------------------------------------------
  -- Se mide el CRECIMIENTO de la cola, no su tamaño: la base puede traer
  -- pedidos pendientes de antes y eso no es un error de la aplicación.
  perform pg_temp.act_as(v_editor);
  v_r := public.admin_cola_aprobacion(v_ciudad);
  v_n := jsonb_array_length(v_r -> 'items');

  perform pg_temp.act_as(v_vecino1);
  v_r := public.obra_crear(v_arb2, v_cat, 'Cámaras de seguridad en la entrada');
  v_obra_cola := (v_r -> 'obra' ->> 'id')::uuid;

  perform pg_temp.act_as(v_editor);
  v_r := public.admin_cola_aprobacion(v_ciudad);
  perform pg_temp.chk('D1 — el pedido nuevo entra a la cola de aprobación',
    jsonb_array_length(v_r -> 'items') = v_n + 1,
    v_n || ' -> ' || jsonb_array_length(v_r -> 'items'));

  perform pg_temp.chk('D2 — la cola trae las causas parecidas del mismo sector',
    (v_r -> 'items' -> 0) ? 'parecidas', (v_r -> 'items' -> 0)::text);

  perform pg_temp.chk('D2b — y el borrador de la IA con lo que dijo el vecino al lado',
    (v_r -> 'items' -> 0) ? 'ia_estado'
    and (v_r -> 'items' -> 0) ? 'texto_original'
    and (v_r -> 'items' -> 0) ? 'audio_url', (v_r -> 'items' -> 0)::text);

  -- Sin título no se publica: un pedido que la IA no alcanzó a ordenar tiene
  -- que pasar por las manos de alguien antes de salir a la cara del candidato.
  update public.obras set titulo = null, ia_estado = 'fallido' where id = v_obra_cola;
  v_r := public.admin_obra_aprobar(v_obra_cola);
  perform pg_temp.chk('D3a — sin título no se puede publicar',
    v_r ->> 'error_code' = 'titulo_requerido', v_r ->> 'error_code');

  -- El ajuste del equipo viaja en la misma llamada que la aprobación.
  v_r := public.admin_obra_aprobar(v_obra_cola, 'Cámaras de seguridad en la entrada del barrio',
                                   'Los vecinos piden vigilancia en el ingreso.');
  perform pg_temp.chk('D3 — el editor publica con el texto corregido',
    (v_r ->> 'success')::boolean, v_r::text);

  perform pg_temp.chk('D3b — y el ajuste queda guardado, no se pierde',
    (select titulo from public.obras where id = v_obra_cola) ilike '%entrada del barrio%',
    (select titulo from public.obras where id = v_obra_cola));

  perform pg_temp.chk('D4 — la obra aprobada queda con sello de quién la aprobó',
    exists (select 1 from public.obras where id = v_obra_cola and aprobada and aprobada_por = v_editor));

  perform pg_temp.act_anon();
  v_r := public.obra_detalle(v_obra_cola);
  perform pg_temp.chk('D5 — ya aprobada, cualquiera la ve', (v_r ->> 'success')::boolean, v_r ->> 'error_code');

  -- Rechazar exige explicar por qué.
  perform pg_temp.act_as(v_editor);
  v_r := public.admin_obra_rechazar(v_obra_cola, 'no');
  perform pg_temp.chk('D6 — rechazar sin explicación no se permite',
    v_r ->> 'error_code' = 'motivo_requerido', v_r ->> 'error_code');

  v_r := public.admin_obra_rechazar(v_obra_cola, 'Duplicado de un pedido que ya existe en el sector.');
  perform pg_temp.chk('D7 — con motivo sí se puede rechazar', (v_r ->> 'success')::boolean, v_r::text);

  perform pg_temp.act_anon();
  v_r := public.obra_detalle(v_obra_cola);
  perform pg_temp.chk('D8 — lo rechazado deja de verse en público',
    v_r ->> 'error_code' = 'obra_no_disponible', v_r ->> 'error_code');

  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_obra_aprobar(v_obra_cola, 'Un título cualquiera del candidato');
  perform pg_temp.chk('D9 — el candidato NO puede aprobar pedidos',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  -- E: fusionar duplicados -------------------------------------------------------
  perform pg_temp.act_as(v_editor);
  select apoyos into v_n from public.obras where id = v_obra;
  v_r := public.admin_obras_fusionar(v_obra, array[v_obra_b]);
  perform pg_temp.chk('E1 — se pueden fusionar dos pedidos duplicados',
    (v_r ->> 'success')::boolean, v_r::text);

  perform pg_temp.chk('E2 — el apoyo exclusivo de la absorbida migra a la que queda',
    (v_r ->> 'apoyos_totales')::integer = v_n + 1,
    v_n || ' -> ' || (v_r ->> 'apoyos_totales'));

  perform pg_temp.chk('E2b — y solo migró uno: el otro votante ya estaba en ambas',
    (v_r ->> 'apoyos_migrados')::integer = 1, v_r ->> 'apoyos_migrados');

  perform pg_temp.chk('E3 — la obra absorbida queda marcada, no borrada',
    exists (select 1 from public.obras where id = v_obra_b and fusionada_en = v_obra));

  perform pg_temp.act_anon();
  v_r := public.obras_listar('el-triunfo', v_arb2);
  perform pg_temp.chk('E4 — la absorbida desaparece del listado público',
    not exists (
      select 1 from jsonb_array_elements(v_r -> 'items') i
       where (i ->> 'id')::uuid = v_obra_b), '');

  -- Un vecino que había apoyado las dos no cuenta doble.
  perform pg_temp.act_as(v_editor);
  select count(*) into v_n from public.votos where obra_id = v_obra and vecino_id = v_vecino2;
  perform pg_temp.chk('E5 — quien apoyaba las dos obras no cuenta dos veces', v_n = 1, v_n::text);

  v_r := public.admin_obras_fusionar(v_obra, array[v_obra]);
  perform pg_temp.chk('E6 — no se puede fusionar una obra consigo misma',
    v_r ->> 'error_code' = 'destino_en_origenes', v_r ->> 'error_code');

  -- F: estados configurables -------------------------------------------------------
  v_r := public.admin_estados_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('nombre', 'Recibida', 'slug', 'recibida', 'orden', 1, 'es_inicial', true),
    jsonb_build_object('nombre', 'En obra', 'slug', 'en-obra', 'orden', 2, 'color', '#0d7d6c')
  ));
  perform pg_temp.chk('F1 — el equipo puede reconfigurar sus estados',
    (v_r ->> 'success')::boolean, v_r::text);

  select count(*) into v_n from public.estados where ciudad_id = v_ciudad and activo;
  perform pg_temp.chk('F2 — quedan solo los estados enviados', v_n = 2, v_n::text);

  select count(*) into v_n from public.estados where ciudad_id = v_ciudad and not activo;
  perform pg_temp.chk('F3 — los viejos se desactivan, no se borran (hay historial apuntando)',
    v_n >= 4, v_n::text);

  v_r := public.admin_estados_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('nombre', 'Uno', 'orden', 1, 'es_inicial', true),
    jsonb_build_object('nombre', 'Dos', 'orden', 2, 'es_inicial', true)
  ));
  perform pg_temp.chk('F4 — no se pueden dejar dos estados iniciales',
    v_r ->> 'error_code' = 'debe_haber_un_estado_inicial', v_r ->> 'error_code');

  v_r := public.admin_estados_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('nombre', 'Uno', 'orden', 1)
  ));
  perform pg_temp.chk('F5 — tampoco se puede quedar sin estado inicial',
    v_r ->> 'error_code' = 'debe_haber_un_estado_inicial', v_r ->> 'error_code');

  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_estados_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('nombre', 'Uno', 'orden', 1, 'es_inicial', true)
  ));
  perform pg_temp.chk('F6 — el candidato NO puede reconfigurar los estados',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  -- G: el tablero de demanda que se le vende al candidato ---------------------------
  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_ranking(v_ciudad);
  perform pg_temp.chk('G1 — el candidato SÍ ve el ranking de demanda',
    (v_r ->> 'success')::boolean, v_r ->> 'error_code');

  perform pg_temp.chk('G2 — el ranking viene desglosado por ciudadela',
    jsonb_array_length(v_r -> 'ciudadelas') >= 70, jsonb_array_length(v_r -> 'ciudadelas')::text);

  perform pg_temp.chk('G3 — y por categoría, que es el guion del mitin',
    jsonb_array_length(v_r -> 'categorias') >= 8, jsonb_array_length(v_r -> 'categorias')::text);

  perform pg_temp.chk('G4 — trae el total de vecinos verificados, que es lo que se vende',
    (v_r -> 'totales' ->> 'vecinos')::integer >= 2, v_r -> 'totales' ->> 'vecinos');

  perform pg_temp.chk('G5 — y cuántos pedidos esperan en la cola',
    (v_r -> 'totales') ? 'en_cola', (v_r -> 'totales')::text);

  perform pg_temp.act_as(v_intruso);
  v_r := public.admin_ranking(v_ciudad);
  perform pg_temp.chk('G6 — alguien de fuera NO ve el ranking',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

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
  raise notice 'smoke-panel — % en verde, % en rojo de %', v_total - v_fail, v_fail, v_total;
  if v_fail > 0 then raise exception 'smoke-panel: % en rojo', v_fail; end if;
end;
$$;

rollback;
