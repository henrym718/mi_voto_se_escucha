-- ============================================================================
-- smoke-notificaciones — la cola de WhatsApp y el freno de mano.
--
-- El freno importa tanto como el envío: si la plataforma se siente spam, el
-- vecino bloquea el número y el padrón que se le vende al candidato se
-- evapora. Aquí se comprueba que el tope se respeta aunque el equipo insista.
--
-- Correr con: ./scripts/run-smokes.sh notificaciones
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
  insert into public.admins (id, ciudad_id, rol) values
    (v_id, (select id from public.ciudades where slug = 'el-triunfo'), p_rol);
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
  v_ciudad uuid; v_arb2 uuid; v_arb3 uuid;
  v_editor uuid; v_candidato uuid;
  v_v1 uuid; v_v2 uuid; v_v3 uuid; v_baja uuid;
  v_obra uuid; v_est uuid; v_cat uuid;
  v_r jsonb; v_n integer; v_i integer;
  v_notif uuid; v_prog timestamptz;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';
  select id into v_arb2 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-2';
  select id into v_arb3 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'arbolito-3';
  select id into v_est  from public.estados where ciudad_id = v_ciudad and slug = 'visitada';
  select id into v_cat  from public.categorias where ciudad_id = v_ciudad and slug = 'sanitario';
  -- La obra se elige por su categoría a propósito: la prueba de segmentación
  -- por interés depende de que los votantes hayan apoyado algo de 'sanitario'.
  select id into v_obra from public.obras
   where ciudadela_id = v_arb2 and categoria_id = v_cat and aprobada limit 1;

  -- Esta suite cuenta destinatarios y porcentajes, así que necesita partir de
  -- un estado conocido. Puede permitirse limpiarlo porque toda la suite vive
  -- dentro de una transacción que termina en rollback: la base queda igual que
  -- estaba. Sin esto, correr las pruebas sobre una base con vecinos reales
  -- (staging, o después de una prueba de punta a punta) las pondría en rojo
  -- por datos ajenos, no por errores.
  delete from public.notificaciones;
  delete from public.votos;
  delete from public.vecinos;


  v_editor    := pg_temp.crear_admin('editor');
  v_candidato := pg_temp.crear_admin('candidato');
  v_v1   := pg_temp.crear_vecino('+593994000001', v_arb2);
  v_v2   := pg_temp.crear_vecino('+593994000002', v_arb2);
  v_v3   := pg_temp.crear_vecino('+593994000003', v_arb3);
  v_baja := pg_temp.crear_vecino('+593994000004', v_arb2);

  insert into public.votos (obra_id, vecino_id, ciudad_id) values (v_obra, v_v1, v_ciudad);
  insert into public.votos (obra_id, vecino_id, ciudad_id) values (v_obra, v_v2, v_ciudad);
  insert into public.votos (obra_id, vecino_id, ciudad_id) values (v_obra, v_baja, v_ciudad);

  -- A: quien pidió la baja no recibe nada -------------------------------------
  perform pg_temp.act_as(v_baja);
  perform public.vecino_darse_de_baja();
  perform pg_temp.chk('A1 — darse de baja queda registrado con fecha',
    exists (select 1 from public.vecinos where id = v_baja and baja_en is not null
              and not consentimiento_notif));

  perform pg_temp.act_as(v_editor);
  v_r := public.admin_obra_cambiar_estado(v_obra, v_est, 'Estuvimos en el sector.');
  perform pg_temp.chk('A2 — el aviso llega a los 2 que apoyaron, no a los 3',
    (v_r ->> 'notificados')::integer = 2, v_r ->> 'notificados');

  select count(*) into v_n from public.notificaciones where vecino_id = v_baja;
  perform pg_temp.chk('A3 — a quien se dio de baja NO se le encola nada', v_n = 0, v_n::text);

  -- B: la forma del mensaje encolado --------------------------------------------
  select count(*) into v_n from public.notificaciones
   where origen_id = v_obra and plantilla = 'obra_avance' and estado = 'pendiente';
  perform pg_temp.chk('B1 — se encola con la plantilla de avance y en pendiente', v_n = 2, v_n::text);

  select count(*) into v_n from public.notificaciones
   where origen_id = v_obra and params ? 'obra' and params ? 'estado' and params ? 'ciudadela';
  perform pg_temp.chk('B2 — el mensaje lleva obra, estado y barrio', v_n = 2, v_n::text);

  select count(*) into v_n from public.notificaciones
   where origen_id = v_obra and boton_path = 'o/' || (select codigo from public.obras where id = v_obra);
  perform pg_temp.chk('B3 — el botón apunta al enlace corto de esa obra', v_n = 2, v_n::text);

  -- C: el worker drena la cola ---------------------------------------------------
  select count(*) into v_n from public.notif_reclamar_lote(25);
  perform pg_temp.chk('C1 — el worker reclama el lote pendiente', v_n = 2, v_n::text);

  select count(*) into v_n from public.notificaciones where estado = 'enviando';
  perform pg_temp.chk('C2 — lo reclamado queda marcado como enviando', v_n = 2, v_n::text);

  -- Un segundo worker no se lleva lo mismo.
  select count(*) into v_n from public.notif_reclamar_lote(25);
  perform pg_temp.chk('C3 — un segundo worker no vuelve a tomar lo ya reclamado', v_n = 0, v_n::text);

  select id into v_notif from public.notificaciones where estado = 'enviando' limit 1;
  perform public.notif_marcar_enviada(v_notif);
  perform pg_temp.chk('C4 — marcar como enviada deja la fecha de envío',
    exists (select 1 from public.notificaciones
             where id = v_notif and estado = 'enviado' and enviada_en is not null));

  -- D: reintentos con espera creciente -------------------------------------------
  select id into v_notif from public.notificaciones where estado = 'enviando' limit 1;
  perform public.notif_marcar_fallida(v_notif, 'Kapso respondió 502');
  select estado, intentos, programada_para into v_r, v_n, v_prog from (
    select jsonb_build_object('e', estado) estado, intentos, programada_para
      from public.notificaciones where id = v_notif) x;
  perform pg_temp.chk('D1 — un fallo vuelve a poner el mensaje en pendiente',
    v_r ->> 'e' = 'pendiente', v_r ->> 'e');
  perform pg_temp.chk('D2 — y lo reprograma unos minutos más tarde',
    v_prog > now() + interval '1 minute', v_prog::text);
  perform pg_temp.chk('D3 — el intento queda contado', v_n = 1, v_n::text);

  perform public.notif_marcar_fallida(v_notif, 'otra vez');
  perform public.notif_marcar_fallida(v_notif, 'y otra');
  select intentos into v_n from public.notificaciones where id = v_notif;
  perform pg_temp.chk('D4 — al tercer fallo sigue reintentando', v_n = 3, v_n::text);

  perform public.notif_marcar_fallida(v_notif, 'cuarta y última');
  perform pg_temp.chk('D5 — al cuarto fallo se marca como fallida y queda para revisar',
    exists (select 1 from public.notificaciones where id = v_notif and estado = 'fallido'));

  perform pg_temp.chk('D6 — el error queda guardado para poder diagnosticar',
    exists (select 1 from public.notificaciones
             where id = v_notif and ultimo_error ilike '%cuarta%'));

  -- E: la difusión segmentada -------------------------------------------------------
  delete from public.notificaciones;
  perform pg_temp.act_as(v_editor);

  v_r := public.admin_difundir(v_ciudad, 'Este sábado a las 10 el candidato visita tu sector.',
                               null, null, null, true);
  perform pg_temp.chk('E1 — la simulación calcula el alcance sin enviar nada',
    (v_r ->> 'simulacion')::boolean and (v_r ->> 'alcance')::integer = 3, v_r::text);

  perform pg_temp.chk('E2 — y estima el costo antes de gastar',
    (v_r ->> 'costo_estimado')::numeric > 0, v_r ->> 'costo_estimado');

  select count(*) into v_n from public.notificaciones;
  perform pg_temp.chk('E3 — la simulación de verdad no encoló nada', v_n = 0, v_n::text);

  -- Segmentar por barrio.
  v_r := public.admin_difundir(v_ciudad, 'Mensaje solo para Arbolito 3.', array[v_arb3]);
  perform pg_temp.chk('E4 — segmentar por ciudadela llega solo a ese barrio',
    (v_r ->> 'encoladas')::integer = 1, v_r ->> 'encoladas');

  delete from public.notificaciones;

  -- Segmentar por interés: solo quienes apoyaron algo de esa categoría.
  v_r := public.admin_difundir(v_ciudad, 'Novedades sobre el alcantarillado del sector.',
                               null, array[v_cat]);
  perform pg_temp.chk('E5 — segmentar por interés llega solo a quien apoyó esa categoría',
    (v_r ->> 'encoladas')::integer = 2, v_r ->> 'encoladas');

  v_r := public.admin_difundir(v_ciudad, 'corto');
  perform pg_temp.chk('E6 — un mensaje demasiado corto se rechaza',
    v_r ->> 'error_code' = 'mensaje_muy_corto', v_r ->> 'error_code');

  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_difundir(v_ciudad, 'El candidato intentando mandar un mensaje solo.');
  perform pg_temp.chk('E7 — el candidato NO puede difundir por su cuenta',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  -- F: el freno de mano contra el spam -------------------------------------------------
  delete from public.notificaciones;
  perform pg_temp.act_as(v_editor);

  v_r := public.admin_difundir(v_ciudad, 'Primera difusión de la semana, todo en orden.');
  perform pg_temp.chk('F1 — la primera difusión de la semana sale completa',
    (v_r ->> 'encoladas')::integer = 3, v_r ->> 'encoladas');

  v_r := public.admin_difundir(v_ciudad, 'Segunda difusión de la semana, todavía dentro del tope.');
  perform pg_temp.chk('F2 — la segunda todavía pasa',
    (v_r ->> 'encoladas')::integer = 3, v_r ->> 'encoladas');

  v_r := public.admin_difundir(v_ciudad, 'Tercera difusión: esta ya debería frenarse sola.');
  perform pg_temp.chk('F3 — la tercera se frena aunque el equipo insista',
    (v_r ->> 'encoladas')::integer = 0, v_r ->> 'encoladas');
  perform pg_temp.chk('F4 — y el panel dice a cuántos se frenó, sin fingir que salió',
    (v_r ->> 'frenados_por_tope')::integer = 3, v_r ->> 'frenados_por_tope');

  -- El aviso de una obra que el vecino pidió NO cuenta contra el tope: eso lo
  -- pidió él y siempre debe llegar.
  v_r := public.admin_obra_cambiar_estado(v_obra,
           (select id from public.estados where ciudad_id = v_ciudad and es_compromiso),
           'Esta obra entra al plan de gobierno.');
  perform pg_temp.chk('F5 — el aviso de su propia obra llega aunque el tope esté lleno',
    (v_r ->> 'notificados')::integer = 2, v_r ->> 'notificados');

  -- G: entrada al Top 3 ------------------------------------------------------------------
  delete from public.notificaciones;
  update public.obras set apoyos = 0, top_avisado_en = null where ciudad_id = v_ciudad;
  update public.obras set apoyos = 25 where id = v_obra;

  v_r := public.notificar_ingresos_top(v_ciudad);
  perform pg_temp.chk('G1 — una obra que entra al Top 3 avisa a quienes la apoyaron',
    (v_r ->> 'notificaciones')::integer >= 2, v_r::text);

  select count(*) into v_n from public.notificaciones where plantilla = 'obra_top';
  perform pg_temp.chk('G2 — el aviso usa su propia plantilla', v_n >= 2, v_n::text);

  v_r := public.notificar_ingresos_top(v_ciudad);
  perform pg_temp.chk('G3 — no se vuelve a avisar lo mismo al día siguiente',
    (v_r ->> 'obras')::integer = 0, v_r::text);

  -- Un Top 3 de un barrio vacío no significa nada y no se anuncia.
  delete from public.notificaciones;
  update public.obras set apoyos = 2, top_avisado_en = null where id = v_obra;
  v_r := public.notificar_ingresos_top(v_ciudad);
  perform pg_temp.chk('G4 — con menos de 10 apoyos no se anuncia ningún Top',
    (v_r ->> 'obras')::integer = 0, v_r::text);

  -- H: el resumen de alcance para el panel ------------------------------------------------
  v_r := public.admin_alcance(v_ciudad);
  perform pg_temp.chk('H1 — el panel puede ver el alcance de sus envíos',
    (v_r ->> 'success')::boolean, v_r ->> 'error_code');
  perform pg_temp.chk('H2 — y cuánta gente se dio de baja, que es la señal de spam',
    (v_r ->> 'bajas')::integer = 1, v_r ->> 'bajas');

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
  raise notice 'smoke-notificaciones — % en verde, % en rojo de %', v_total - v_fail, v_fail, v_total;
  if v_fail > 0 then raise exception 'smoke-notificaciones: % en rojo', v_fail; end if;
end;
$$;

rollback;
