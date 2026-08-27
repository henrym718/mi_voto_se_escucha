-- ============================================================================
-- smoke-catalogo — sectores y categorías editables desde el panel.
--
-- Lo que más se vigila aquí es que quitar algo NO borre nada: hay obras, votos
-- y fichas de vecinos colgando de cada sector, y un delete silencioso se lleva
-- por delante el padrón del barrio. Lo segundo es que un lote con un error no
-- escriba a medias: el equipo aprieta guardar una vez y o entra todo o no
-- entra nada.
--
-- Correr con: ./scripts/run-smokes.sh catalogo
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
  insert into public.admins (id, ciudad_id, rol, nombre)
  values (v_id, (select id from public.ciudades where slug = 'el-triunfo'), p_rol, 'Prueba ' || p_rol);
  return v_id;
end; $$;

-- La lista completa de sectores activos, en el formato que espera la RPC. Es
-- el punto de partida de casi cada caso: la puerta recibe la lista entera.
create function pg_temp.sectores_activos(p_ciudad uuid) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('id', cd.id, 'nombre', cd.nombre, 'zona', cd.zona)
           order by cd.orden, cd.nombre
         ), '[]'::jsonb)
    from public.ciudadelas cd
   where cd.ciudad_id = p_ciudad and cd.activa;
$$;

create function pg_temp.categorias_activas(p_ciudad uuid) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('id', ct.id, 'nombre', ct.nombre, 'icono', ct.icono)
           order by ct.orden, ct.nombre
         ), '[]'::jsonb)
    from public.categorias ct
   where ct.ciudad_id = p_ciudad and ct.activa;
$$;

do $t$
declare
  v_ciudad uuid; v_categoria uuid;
  v_editor uuid; v_candidato uuid; v_intruso uuid;
  v_r jsonb; v_base jsonb; v_lista jsonb;
  v_sector public.ciudadelas; v_ceibos uuid; v_victima uuid;
  v_obras integer; v_total integer;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';
  select id into v_categoria from public.categorias
   where ciudad_id = v_ciudad and activa order by orden limit 1;

  v_editor    := pg_temp.crear_admin('editor');
  v_candidato := pg_temp.crear_admin('candidato');
  v_intruso   := pg_temp.crear_usuario();

  -- =============================================== agregar un sector nuevo ==
  perform pg_temp.act_as(v_editor);
  v_base := pg_temp.sectores_activos(v_ciudad);

  v_r := public.admin_ciudadelas_guardar(v_ciudad, v_base || jsonb_build_array(
    jsonb_build_object('nombre', 'Ciudadela Los Ceibos', 'zona', 'urbana',
                       'poblacion_estimada', 850,
                       'fuente', 'Recorrido del 12 de agosto')
  ));
  perform pg_temp.chk('A1 — el editor agrega una ciudadela nueva',
    (v_r ->> 'success')::boolean, v_r::text);

  select * into v_sector from public.ciudadelas
   where ciudad_id = v_ciudad and slug = 'ciudadela-los-ceibos';
  v_ceibos := v_sector.id;
  perform pg_temp.chk('A2 — el slug sale del nombre', v_ceibos is not null,
    coalesce(v_ceibos::text, 'null'));
  perform pg_temp.chk('A3 — guarda zona, población y de dónde salió',
    v_sector.zona = 'urbana' and v_sector.poblacion_estimada = 850
    and v_sector.fuente = 'Recorrido del 12 de agosto',
    v_sector.zona || ' / ' || coalesce(v_sector.poblacion_estimada::text, 'null'));
  perform pg_temp.chk('A4 — nace por verificar: no hay documento municipal detrás',
    not v_sector.verificado, v_sector.verificado::text);

  -- ==================================== quitar un sector NO borra su historia ==
  -- Se elige uno con obras encima a propósito: es el caso que duele.
  select o.ciudadela_id into v_victima
    from public.obras o
   where o.ciudad_id = v_ciudad
   group by o.ciudadela_id
   order by count(*) desc
   limit 1;

  select count(*)::integer into v_obras from public.obras where ciudadela_id = v_victima;

  select jsonb_agg(e) into v_lista
    from jsonb_array_elements(pg_temp.sectores_activos(v_ciudad)) e
   where (e ->> 'id')::uuid <> v_victima;

  v_r := public.admin_ciudadelas_guardar(v_ciudad, v_lista);
  perform pg_temp.chk('B1 — quitar un sector de la lista se guarda',
    (v_r ->> 'success')::boolean, v_r::text);

  select * into v_sector from public.ciudadelas where id = v_victima;
  perform pg_temp.chk('B2 — el sector sigue existiendo, solo desactivado',
    v_sector.id is not null and not v_sector.activa,
    coalesce(v_sector.activa::text, 'desapareció'));

  select count(*)::integer into v_total from public.obras where ciudadela_id = v_victima;
  perform pg_temp.chk('B3 — sus obras siguen colgando de él',
    v_total = v_obras and v_obras > 0, v_total || ' de ' || v_obras);

  perform pg_temp.chk('B4 — y desaparece del catálogo que ve el vecino',
    not exists (select 1 from public.ciudadelas
                 where id = v_victima and activa), 'sigue activa');

  -- Volver a escribir el mismo nombre lo revive: es lo que pasa cuando alguien
  -- lo quita por error y lo vuelve a agregar sin saber que ya existía.
  v_r := public.admin_ciudadelas_guardar(v_ciudad,
    pg_temp.sectores_activos(v_ciudad) || jsonb_build_array(
      jsonb_build_object('nombre', v_sector.nombre, 'zona', v_sector.zona)
    ));
  perform pg_temp.chk('B5 — reescribir el nombre revive el sector, no lo duplica',
    (v_r ->> 'success')::boolean
    and (select count(*) from public.ciudadelas
          where ciudad_id = v_ciudad and slug = v_sector.slug) = 1
    and (select activa from public.ciudadelas where id = v_victima),
    v_r::text);

  select count(*)::integer into v_total from public.obras where ciudadela_id = v_victima;
  perform pg_temp.chk('B6 — al revivir recupera sus obras intactas',
    v_total = v_obras, v_total::text);

  -- ============================================= renombrar sin romper enlaces ==
  v_r := public.admin_ciudadelas_guardar(v_ciudad, (
    select jsonb_agg(case when (e ->> 'id')::uuid = v_ceibos
                          then e || jsonb_build_object('nombre', 'Los Ceibos Etapa 2')
                          else e end)
      from jsonb_array_elements(pg_temp.sectores_activos(v_ciudad)) e
  ));
  select * into v_sector from public.ciudadelas where id = v_ceibos;
  perform pg_temp.chk('C1 — renombrar cambia el nombre',
    v_sector.nombre = 'Los Ceibos Etapa 2', v_sector.nombre);
  perform pg_temp.chk('C2 — pero NO el slug: hay enlaces circulando con él',
    v_sector.slug = 'ciudadela-los-ceibos', v_sector.slug);

  -- =========================================== el orden del array es el orden ==
  v_r := public.admin_ciudadelas_guardar(v_ciudad, (
    select jsonb_agg(e order by e ->> 'nombre' desc)
      from jsonb_array_elements(pg_temp.sectores_activos(v_ciudad)) e
  ));
  perform pg_temp.chk('C3 — el primero del array queda con orden 1',
    (select orden from public.ciudadelas
      where ciudad_id = v_ciudad and activa order by orden limit 1) = 1,
    (select orden::text from public.ciudadelas
      where ciudad_id = v_ciudad and activa order by orden limit 1));

  -- ======================================================== lo que se rechaza ==
  v_base := pg_temp.sectores_activos(v_ciudad);

  v_r := public.admin_ciudadelas_guardar(v_ciudad, v_base || jsonb_build_array(
    jsonb_build_object('nombre', 'La')
  ));
  perform pg_temp.chk('D1 — un nombre de dos letras se rechaza',
    v_r ->> 'error_code' = 'nombre_muy_corto', v_r ->> 'error_code');

  v_r := public.admin_ciudadelas_guardar(v_ciudad, v_base || jsonb_build_array(
    jsonb_build_object('nombre', 'Sector Marino', 'zona', 'submarina')
  ));
  perform pg_temp.chk('D2 — una zona inventada se rechaza',
    v_r ->> 'error_code' = 'zona_invalida', v_r ->> 'error_code');

  v_r := public.admin_ciudadelas_guardar(v_ciudad, v_base || jsonb_build_array(
    jsonb_build_object('nombre', 'Sector Facebook',
                       'enlace_canal', 'https://facebook.com/grupo')
  ));
  perform pg_temp.chk('D3 — un enlace que no es de WhatsApp se rechaza',
    v_r ->> 'error_code' = 'enlace_invalido', v_r ->> 'error_code');

  v_r := public.admin_ciudadelas_guardar(v_ciudad, v_base || jsonb_build_array(
    jsonb_build_object('nombre', 'Sector Repetido'),
    jsonb_build_object('nombre', 'Sector repetido')
  ));
  perform pg_temp.chk('D4 — dos sectores con el mismo nombre se rechazan de frente',
    v_r ->> 'error_code' = 'sector_repetido', v_r ->> 'error_code');

  v_r := public.admin_ciudadelas_guardar(v_ciudad, '[]'::jsonb);
  perform pg_temp.chk('D5 — vaciar la lista se rechaza: el vecino se queda sin elegir',
    v_r ->> 'error_code' = 'sin_sectores', v_r ->> 'error_code');

  -- Todo lo de arriba llevaba delante un sector válido. Si la validación no
  -- fuera previa, ese primero ya estaría escrito y el catálogo tendría basura.
  perform pg_temp.chk('D6 — un lote con un error no escribe NADA',
    not exists (select 1 from public.ciudadelas
                 where ciudad_id = v_ciudad
                   and slug in ('sector-marino', 'sector-facebook', 'sector-repetido')),
    (select string_agg(slug, ', ') from public.ciudadelas
      where ciudad_id = v_ciudad
        and slug in ('sector-marino', 'sector-facebook', 'sector-repetido')));

  -- ============================================================== permisos ==
  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_ciudadelas_guardar(v_ciudad, v_base);
  perform pg_temp.chk('E1 — el candidato (solo lectura) NO toca el catálogo',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  perform pg_temp.act_as(v_intruso);
  v_r := public.admin_ciudadelas_guardar(v_ciudad, v_base);
  perform pg_temp.chk('E2 — alguien de fuera tampoco',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  v_r := public.admin_catalogo_listar(v_ciudad);
  perform pg_temp.chk('E3 — ni siquiera puede LEER el catálogo del panel',
    v_r ->> 'error_code' = 'sin_permiso', v_r ->> 'error_code');

  -- El candidato sí lee: su panel es de solo lectura, no de puertas cerradas.
  perform pg_temp.act_as(v_candidato);
  v_r := public.admin_catalogo_listar(v_ciudad);
  perform pg_temp.chk('E4 — el candidato sí puede mirarlo',
    (v_r ->> 'success')::boolean, v_r ->> 'error_code');

  -- ============================================================== categorías ==
  perform pg_temp.act_as(v_editor);
  v_base := pg_temp.categorias_activas(v_ciudad);

  v_r := public.admin_categorias_guardar(v_ciudad, v_base || jsonb_build_array(
    jsonb_build_object('nombre', 'Transporte y paradas', 'icono', 'bus', 'color', '#4a90a4')
  ));
  perform pg_temp.chk('F1 — el editor agrega una categoría nueva',
    (v_r ->> 'success')::boolean, v_r::text);
  perform pg_temp.chk('F2 — con su icono y su color',
    (select icono = 'bus' and color = '#4a90a4' from public.categorias
      where ciudad_id = v_ciudad and slug = 'transporte-y-paradas'), '');

  v_r := public.admin_categorias_guardar(v_ciudad, (
    select jsonb_agg(e) from jsonb_array_elements(v_base) e
     where (e ->> 'id')::uuid <> v_categoria
  ));
  perform pg_temp.chk('F3 — la categoría que ya no viene se desactiva, no se borra',
    (select not activa from public.categorias where id = v_categoria),
    (select activa::text from public.categorias where id = v_categoria));

  -- Y a partir de ahí no se puede clasificar nada con ella: es la comprobación
  -- que cierra el círculo entre esta pantalla y la de levantar un pedido.
  v_r := public.admin_obra_crear(
    (select id from public.ciudadelas where ciudad_id = v_ciudad and activa limit 1),
    v_categoria, 'Pedido con una categoría apagada');
  perform pg_temp.chk('F4 — ya no se puede levantar un pedido con ella',
    v_r ->> 'error_code' = 'categoria_invalida', v_r ->> 'error_code');

  v_r := public.admin_categorias_guardar(v_ciudad, '[]'::jsonb);
  perform pg_temp.chk('F5 — quedarse sin categorías se rechaza',
    v_r ->> 'error_code' = 'sin_categorias', v_r ->> 'error_code');

  -- ================================================================ listar ==
  v_r := public.admin_catalogo_listar(v_ciudad);
  perform pg_temp.chk('G1 — el listado del panel trae sectores y categorías',
    (v_r ->> 'success')::boolean
    and jsonb_array_length(v_r -> 'ciudadelas') > 0
    and jsonb_array_length(v_r -> 'categorias') > 0, v_r ->> 'error_code');

  perform pg_temp.chk('G2 — incluye los desactivados, para poder revivirlos',
    exists (select 1 from jsonb_array_elements(v_r -> 'categorias') e
             where (e ->> 'id')::uuid = v_categoria
               and not (e ->> 'activa')::boolean), '');

  perform pg_temp.chk('G3 — cada sector dice cuántas obras y vecinos cuelgan de él',
    (select (e -> 'obras') is not null and (e -> 'vecinos') is not null
       from jsonb_array_elements(v_r -> 'ciudadelas') e limit 1), '');

  perform pg_temp.chk('G4 — y el conteo de obras es el de verdad',
    (select (e ->> 'obras')::integer from jsonb_array_elements(v_r -> 'ciudadelas') e
      where (e ->> 'id')::uuid = v_victima) = v_obras, v_obras::text);

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
  raise notice 'smoke-catalogo — % en verde, % en rojo de %', v_total - v_fail, v_fail, v_total;
  if v_fail > 0 then raise exception 'smoke-catalogo: % en rojo', v_fail; end if;
end;
$$;

rollback;
