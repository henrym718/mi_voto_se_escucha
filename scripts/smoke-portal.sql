-- ============================================================================
-- smoke-portal — la cara pública editable desde el panel.
--
-- Cubre las tres puertas nuevas: guardar la portada, mantener las fichas del
-- equipo, y levantar un pedido desde el panel sin pasar por la cola. Lo que
-- más se vigila aquí es que el candidato (solo lectura) y cualquier extraño
-- no puedan tocar nada: esta pantalla escribe lo primero que ve un vecino.
--
-- Correr con: ./scripts/run-smokes.sh portal
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

do $t$
declare
  v_ciudad uuid; v_ciudadela uuid; v_categoria uuid;
  v_editor uuid; v_candidato uuid; v_intruso uuid;
  v_r jsonb; v_portal public.portal; v_obra public.obras;
  v_id_perfil uuid; v_total integer;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';
  select id into v_ciudadela from public.ciudadelas
   where ciudad_id = v_ciudad order by nombre limit 1;
  select id into v_categoria from public.categorias
   where ciudad_id = v_ciudad and activa order by orden limit 1;

  v_editor    := pg_temp.crear_admin('editor');
  v_candidato := pg_temp.crear_admin('candidato');
  v_intruso   := pg_temp.crear_usuario();

  -- ================================================== guardar la portada ==
  perform pg_temp.act_as(v_editor);
  v_r := public.admin_portal_guardar(v_ciudad, jsonb_build_object(
    'candidato_nombre', 'Fernando Flores',
    'candidato_cargo', 'Candidato a la Alcaldía',
    'cedula', '0912345678',
    'eslogan', 'El Triunfo lo decidimos entre todos',
    'hero_subtitulo', 'Pide la obra que le hace falta a tu barrio.',
    'hero_medio', 'foto',
    'foto_hero_url', 'https://ejemplo.test/recorte.png'
  ));
  perform pg_temp.chk('A1 — un editor guarda la portada', (v_r ->> 'success')::boolean, v_r::text);

  select * into v_portal from public.portal where ciudad_id = v_ciudad;
  perform pg_temp.chk('A2 — el nombre queda guardado',
    v_portal.candidato_nombre = 'Fernando Flores', v_portal.candidato_nombre);
  perform pg_temp.chk('A3 — la cédula queda guardada', v_portal.cedula = '0912345678', v_portal.cedula);
  perform pg_temp.chk('A4 — el recorte del hero queda guardado',
    v_portal.foto_hero_url = 'https://ejemplo.test/recorte.png', v_portal.foto_hero_url);

  -- Lo que no viene en el jsonb NO se pisa: el panel puede mandar solo la
  -- pestaña que el equipo tocó sin borrar el resto de la portada.
  v_r := public.admin_portal_guardar(v_ciudad, jsonb_build_object('partido', 'Movimiento X'));
  select * into v_portal from public.portal where ciudad_id = v_ciudad;
  perform pg_temp.chk('A5 — un guardado parcial no borra los campos ausentes',
    v_portal.candidato_nombre = 'Fernando Flores' and v_portal.partido = 'Movimiento X',
    v_portal.candidato_nombre || ' / ' || v_portal.partido);

  -- Pero una url enviada vacía SÍ se vacía: es como el panel quita una foto.
  v_r := public.admin_portal_guardar(v_ciudad, jsonb_build_object('foto_hero_url', ''));
  select * into v_portal from public.portal where ciudad_id = v_ciudad;
  perform pg_temp.chk('A6 — mandar la url vacía borra la imagen',
    v_portal.foto_hero_url is null, coalesce(v_portal.foto_hero_url, 'null'));

  v_r := public.admin_portal_guardar(v_ciudad, jsonb_build_object('hero_medio', 'carrusel'));
  perform pg_temp.chk('A7 — un medio de hero inventado se rechaza',
    v_r ->> 'error_code' = 'hero_medio_invalido', v_r ->> 'error_code');

  -- ==================================== la portada del candidato, apagada ==
  -- Si algún día nace encendida, cada ciudad nueva estrena la home con la foto
  -- grande del candidato. Es justo lo que el diseño evita, así que se vigila.
  select * into v_portal from public.portal where ciudad_id = v_ciudad;
  perform pg_temp.chk('A7a — la portada del candidato nace APAGADA',
    not v_portal.hero_candidato, v_portal.hero_candidato::text);

  v_r := public.admin_portal_guardar(v_ciudad, jsonb_build_object('hero_candidato', true));
  perform pg_temp.chk('A7b — el equipo la puede encender',
    (select hero_candidato from public.portal where ciudad_id = v_ciudad), v_r::text);

  -- Guardar otra pestaña no puede apagarla ni encenderla por omisión.
  -- Se toca el subtítulo y NO el eslogan: A10 comprueba más abajo que el
  -- eslogan sobrevivió a los intentos sin permiso, y pisarlo aquí haría fallar
  -- una prueba que no tiene nada que ver con esto.
  v_r := public.admin_portal_guardar(v_ciudad, jsonb_build_object('hero_subtitulo', 'Otro subtítulo'));
  perform pg_temp.chk('A7c — un guardado parcial no la toca',
    (select hero_candidato from public.portal where ciudad_id = v_ciudad),
    (select hero_candidato::text from public.portal where ciudad_id = v_ciudad));

  v_r := public.admin_portal_guardar(v_ciudad, jsonb_build_object('hero_candidato', false));
  perform pg_temp.chk('A7d — y la puede volver a apagar',
    (select not hero_candidato from public.portal where ciudad_id = v_ciudad),
    (select hero_candidato::text from public.portal where ciudad_id = v_ciudad));

  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_portal_guardar(v_ciudad, jsonb_build_object('eslogan', 'pisado'));
  perform pg_temp.chk('A8 — el candidato (solo lectura) NO puede guardar la portada',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  perform pg_temp.act_as(v_intruso);
  v_r := public.admin_portal_guardar(v_ciudad, jsonb_build_object('eslogan', 'pisado'));
  perform pg_temp.chk('A9 — alguien de fuera tampoco',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  select * into v_portal from public.portal where ciudad_id = v_ciudad;
  perform pg_temp.chk('A10 — y el eslogan siguió intacto tras los dos intentos',
    v_portal.eslogan = 'El Triunfo lo decidimos entre todos', v_portal.eslogan);

  -- La portada pública tiene que devolver los campos nuevos, o el hero se
  -- pinta con los valores por defecto aunque el equipo los haya llenado.
  perform pg_temp.act_anon();
  v_r := public.ciudad_portada('el-triunfo');
  perform pg_temp.chk('A11 — ciudad_portada expone cédula, subtítulo y medio del hero',
    (v_r -> 'portal') ? 'cedula' and (v_r -> 'portal') ? 'hero_subtitulo'
    and (v_r -> 'portal') ? 'hero_medio' and (v_r -> 'portal') ? 'foto_hero_url'
    and (v_r -> 'portal') ? 'hero_candidato',
    (v_r -> 'portal')::text);

  -- ========================================================== perfiles ==
  perform pg_temp.act_as(v_editor);
  v_r := public.admin_perfiles_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('nombre', 'Fernando Flores', 'cargo', 'Candidato', 'es_candidato', true),
    jsonb_build_object('nombre', 'María Zambrano', 'cargo', 'Coordinadora de barrios')
  ));
  perform pg_temp.chk('B1 — el editor guarda las fichas del equipo',
    (v_r ->> 'success')::boolean, v_r::text);

  select count(*)::integer into v_total from public.perfiles
   where ciudad_id = v_ciudad and activo;
  perform pg_temp.chk('B2 — quedan solo las dos enviadas (la sembrada se desactiva)',
    v_total = 2, v_total::text);

  select id into v_id_perfil from public.perfiles
   where ciudad_id = v_ciudad and slug = 'maria-zambrano';
  perform pg_temp.chk('B3 — el slug sale del nombre', v_id_perfil is not null,
    coalesce(v_id_perfil::text, 'null'));

  -- El orden del array manda: es el orden en que se ven en la página.
  v_r := public.admin_perfiles_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('id', v_id_perfil, 'nombre', 'María Zambrano', 'cargo', 'Coordinadora'),
    jsonb_build_object('nombre', 'Fernando Flores', 'cargo', 'Candidato', 'es_candidato', true)
  ));
  perform pg_temp.chk('B4 — reordenar y renombrar cargos funciona',
    (v_r ->> 'success')::boolean, v_r::text);
  perform pg_temp.chk('B5 — quien iba primero en el array queda con orden 0',
    (select orden from public.perfiles where id = v_id_perfil) = 0,
    (select orden from public.perfiles where id = v_id_perfil)::text);

  -- Alguien que vuelve al equipo revive su ficha en vez de reventar por slug
  -- repetido: el slug es la url pública y no se puede duplicar.
  select count(*)::integer into v_total from public.perfiles
   where ciudad_id = v_ciudad and slug = 'fernando-flores';
  perform pg_temp.chk('B6 — no se duplicó el slug al reenviar a Fernando',
    v_total = 1, v_total::text);

  v_r := public.admin_perfiles_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('nombre', 'X')
  ));
  perform pg_temp.chk('B7 — un nombre de una letra se rechaza',
    v_r ->> 'error_code' = 'nombre_muy_corto', v_r ->> 'error_code');

  -- ============================================ video de presentación ==
  -- El enlace acaba dentro de un iframe en la ficha pública, así que la lista
  -- blanca se comprueba en la base y no solo en el formulario del panel.
  v_r := public.admin_perfiles_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('id', v_id_perfil, 'nombre', 'María Zambrano', 'cargo', 'Coordinadora',
                       'video_url', 'https://youtu.be/dQw4w9WgXcQ')
  ));
  perform pg_temp.chk('B7a — se guarda un enlace de YouTube',
    (v_r ->> 'success')::boolean
    and (select video_url from public.perfiles where id = v_id_perfil) = 'https://youtu.be/dQw4w9WgXcQ',
    v_r::text);

  perform pg_temp.chk('B7b — y llega a la ficha pública',
    public.portal_perfil('el-triunfo', 'maria-zambrano') -> 'perfil' ->> 'video_url'
      = 'https://youtu.be/dQw4w9WgXcQ',
    public.portal_perfil('el-triunfo', 'maria-zambrano') -> 'perfil' ->> 'video_url');

  v_r := public.admin_perfiles_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('id', v_id_perfil, 'nombre', 'María Zambrano', 'cargo', 'Coordinadora',
                       'video_url', 'https://vimeo.com/12345')
  ));
  perform pg_temp.chk('B7c — un enlace que NO es de YouTube se rechaza',
    v_r ->> 'error_code' = 'video_no_es_youtube', v_r ->> 'error_code');

  perform pg_temp.chk('B7d — y el que ya estaba guardado no se pisó',
    (select video_url from public.perfiles where id = v_id_perfil) = 'https://youtu.be/dQw4w9WgXcQ',
    (select coalesce(video_url, 'null') from public.perfiles where id = v_id_perfil));

  -- Vaciar el campo sí se acepta: es como el equipo quita un video.
  v_r := public.admin_perfiles_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('id', v_id_perfil, 'nombre', 'María Zambrano', 'cargo', 'Coordinadora',
                       'video_url', '')
  ));
  perform pg_temp.chk('B7e — mandarlo vacío quita el video',
    (v_r ->> 'success')::boolean
    and (select video_url is null from public.perfiles where id = v_id_perfil),
    v_r::text);

  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_perfiles_guardar(v_ciudad, '[]'::jsonb);
  perform pg_temp.chk('B8 — el candidato NO puede vaciar la lista de perfiles',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  -- Quitar a alguien lo esconde del vecino, no borra su historial.
  perform pg_temp.act_as(v_editor);
  v_r := public.admin_perfiles_guardar(v_ciudad, jsonb_build_array(
    jsonb_build_object('id', v_id_perfil, 'nombre', 'María Zambrano', 'cargo', 'Coordinadora')
  ));
  perform pg_temp.chk('B9 — la ficha que ya no viene se desactiva, no se borra',
    (select not activo from public.perfiles where ciudad_id = v_ciudad and slug = 'fernando-flores'),
    (select activo::text from public.perfiles where ciudad_id = v_ciudad and slug = 'fernando-flores'));

  perform pg_temp.act_anon();
  v_r := public.portal_perfiles('el-triunfo');
  perform pg_temp.chk('B10 — la lista pública trae solo las fichas activas',
    jsonb_array_length(v_r -> 'items') = 1, v_r ->> 'items');

  v_r := public.portal_perfil('el-triunfo', 'maria-zambrano');
  perform pg_temp.chk('B11 — la ficha se abre por slug sin sesión',
    (v_r ->> 'success')::boolean and v_r -> 'perfil' ->> 'nombre' = 'María Zambrano',
    v_r::text);

  v_r := public.portal_perfil('el-triunfo', 'fernando-flores');
  perform pg_temp.chk('B12 — una ficha desactivada devuelve no encontrada',
    v_r ->> 'error_code' = 'perfil_no_encontrado', v_r ->> 'error_code');

  -- ======================================== pedido levantado por el equipo ==
  perform pg_temp.act_as(v_editor);
  v_r := public.admin_obra_crear(v_ciudadela, v_categoria,
    'Rejilla rota en la calle 4', 'Se inunda cuando llueve.', null,
    'Asamblea de barrio del 14 de marzo');
  perform pg_temp.chk('C1 — el editor levanta un pedido', (v_r ->> 'success')::boolean, v_r::text);

  select * into v_obra from public.obras where id = (v_r -> 'obra' ->> 'id')::uuid;
  perform pg_temp.chk('C2 — nace publicado, sin pasar por la cola', v_obra.aprobada, v_obra.aprobada::text);
  perform pg_temp.chk('C3 — queda marcado con origen equipo', v_obra.origen = 'equipo', v_obra.origen);
  perform pg_temp.chk('C4 — arranca con cero apoyos: el respaldo lo ponen los vecinos',
    v_obra.apoyos = 0, v_obra.apoyos::text);
  perform pg_temp.chk('C5 — guarda de dónde salió',
    v_obra.fuente = 'Asamblea de barrio del 14 de marzo', coalesce(v_obra.fuente, 'null'));
  perform pg_temp.chk('C6 — sin creador vecino: no es de nadie en particular',
    v_obra.creador_id is null, coalesce(v_obra.creador_id::text, 'null'));

  v_r := public.admin_obra_crear(v_ciudadela, v_categoria, 'corto');
  perform pg_temp.chk('C7 — un título de menos de 8 letras se rechaza',
    v_r ->> 'error_code' = 'titulo_muy_corto', v_r ->> 'error_code');

  v_r := public.admin_obra_crear(v_ciudadela, gen_random_uuid(), 'Una obra con categoría falsa');
  perform pg_temp.chk('C8 — una categoría de otra ciudad o inexistente se rechaza',
    v_r ->> 'error_code' = 'categoria_invalida', v_r ->> 'error_code');

  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_obra_crear(v_ciudadela, v_categoria, 'El candidato no publica esto');
  perform pg_temp.chk('C9 — el candidato (solo lectura) NO puede levantar pedidos',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  perform pg_temp.act_as(v_intruso);
  v_r := public.admin_obra_crear(v_ciudadela, v_categoria, 'Un extraño tampoco publica esto');
  perform pg_temp.chk('C10 — alguien de fuera tampoco',
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
  raise notice 'smoke-portal — % en verde, % en rojo de %', v_total - v_fail, v_fail, v_total;
  if v_fail > 0 then raise exception 'smoke-portal: % en rojo', v_fail; end if;
end;
$$;

rollback;
