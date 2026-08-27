-- ============================================================================
-- smoke-territorio — el catálogo del cantón y la configuración de la ciudad.
--
-- Comprueba que el seed dejó El Triunfo utilizable: ciudadelas con su origen
-- marcado, categorías ordenadas por déficit real, un único estado inicial, y
-- las obras del PDOT con su fuente citada y sin apoyos inventados.
--
-- Correr con: ./scripts/run-smokes.sh territorio
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages to warning;

begin;

create temp table t_results (n serial, test text, pass boolean, detail text) on commit drop;

create function pg_temp.chk(p_test text, p_pass boolean, p_detail text default '') returns void
language sql as $$
  insert into t_results (test, pass, detail) values (p_test, coalesce(p_pass, false), p_detail);
$$;

do $t$
declare
  v_ciudad uuid;
  v_n integer;
  v_txt text;
begin
  -- A1 --------------------------------------------------------------------
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';
  perform pg_temp.chk('A1 — la ciudad El Triunfo existe y está activa',
    v_ciudad is not null, coalesce(v_ciudad::text, 'no encontrada'));

  -- A2 -- la población es la del censo 2022, no la proyección de Wikipedia --
  select poblacion_urbana into v_n from public.ciudades where id = v_ciudad;
  perform pg_temp.chk('A2 — población urbana del censo INEC 2022 (41.042)',
    v_n = 41042, coalesce(v_n::text, 'null'));

  -- A3 --------------------------------------------------------------------
  select count(*) into v_n from public.ciudadelas where ciudad_id = v_ciudad;
  perform pg_temp.chk('A3 — hay al menos 70 ciudadelas cargadas', v_n >= 70, v_n::text);

  -- A4 -- las de documento municipal quedan marcadas como verificadas ------
  select count(*) into v_n from public.ciudadelas where ciudad_id = v_ciudad and verificado;
  perform pg_temp.chk('A4 — 60+ ciudadelas verificadas por documento municipal', v_n >= 60, v_n::text);

  -- A5 -- las de OSM NO se hacen pasar por verificadas ---------------------
  select count(*) into v_n from public.ciudadelas
   where ciudad_id = v_ciudad and not verificado and fuente ilike '%OpenStreetMap%';
  perform pg_temp.chk('A5 — las de OpenStreetMap quedan marcadas por verificar', v_n >= 8, v_n::text);

  -- A6 -- toda ciudadela cita su fuente ------------------------------------
  select count(*) into v_n from public.ciudadelas
   where ciudad_id = v_ciudad and (fuente is null or trim(fuente) = '');
  perform pg_temp.chk('A6 — ninguna ciudadela sin fuente citada', v_n = 0, v_n || ' sin fuente');

  -- A7 -- "Centro" no se presenta como ciudadela documentada ---------------
  select zona into v_txt from public.ciudadelas where ciudad_id = v_ciudad and slug = 'centro';
  perform pg_temp.chk('A7 — "Centro" está como sector funcional, no como ciudadela',
    v_txt = 'funcional', coalesce(v_txt, 'no existe'));

  -- A8 -- los Arbolito confirmados por el PDOT están -----------------------
  select count(*) into v_n from public.ciudadelas
   where ciudad_id = v_ciudad and slug in ('arbolito-1', 'arbolito-2', 'arbolito-3');
  perform pg_temp.chk('A8 — Arbolito 1, 2 y 3 existen', v_n = 3, v_n::text);

  -- A9 -- La Cartonera existe con el nombre de la fuente -------------------
  perform pg_temp.chk('A9 — La Cartonera cargada como Lotización',
    exists (select 1 from public.ciudadelas where ciudad_id = v_ciudad and slug = 'lotizacion-la-cartonera'));

  -- B1 -- categorías ordenadas por déficit real, no alfabéticamente --------
  select slug into v_txt from public.categorias where ciudad_id = v_ciudad order by orden limit 1;
  perform pg_temp.chk('B1 — la primera categoría es el pluvial (76% de déficit)',
    v_txt = 'pluvial', coalesce(v_txt, 'ninguna'));

  select slug into v_txt from public.categorias where ciudad_id = v_ciudad order by orden offset 1 limit 1;
  perform pg_temp.chk('B2 — la segunda es el sanitario', v_txt = 'sanitario', coalesce(v_txt, 'ninguna'));

  -- B3 --------------------------------------------------------------------
  select count(*) into v_n from public.categorias where ciudad_id = v_ciudad and activa;
  perform pg_temp.chk('B3 — hay al menos 8 categorías activas', v_n >= 8, v_n::text);

  -- C1 -- exactamente un estado inicial ------------------------------------
  select count(*) into v_n from public.estados where ciudad_id = v_ciudad and es_inicial;
  perform pg_temp.chk('C1 — exactamente un estado inicial', v_n = 1, v_n::text);

  -- C2 -- el índice único lo impide de verdad ------------------------------
  begin
    insert into public.estados (ciudad_id, nombre, slug, orden, es_inicial)
    values (v_ciudad, 'Otro inicial', 'otro-inicial', 99, true);
    perform pg_temp.chk('C2 — la base rechaza un segundo estado inicial', false, 'lo aceptó');
  exception when unique_violation then
    perform pg_temp.chk('C2 — la base rechaza un segundo estado inicial', true, 'unique_violation');
  end;

  -- C3 -- NO existe un estado "no viable": es veneno político --------------
  select count(*) into v_n from public.estados
   where ciudad_id = v_ciudad and (slug ilike '%no-viable%' or nombre ilike '%no viable%');
  perform pg_temp.chk('C3 — no existe ningún estado "No viable"', v_n = 0, v_n::text);

  -- C4 -- pero sí hay aterrizajes suaves para que nada quede en silencio ---
  select count(*) into v_n from public.estados where ciudad_id = v_ciudad and es_cierre_suave;
  perform pg_temp.chk('C4 — hay estados de cierre suave para no dejar pedidos mudos',
    v_n >= 2, v_n::text);

  -- C5 -- ningún sector arranca con canal de WhatsApp puesto ---------------
  -- Los canales se crean a mano en WhatsApp y el equipo pega el enlace desde el
  -- panel. Un enlace sembrado sería un enlace roto en la cara del vecino.
  select count(*) into v_n from public.ciudadelas
   where ciudad_id = v_ciudad and enlace_canal is not null;
  perform pg_temp.chk('C5 — ningún sector nace con un enlace de canal inventado',
    v_n = 0, v_n::text);

  -- C6 -- hay exactamente un estado de compromiso --------------------------
  select count(*) into v_n from public.estados where ciudad_id = v_ciudad and es_compromiso;
  perform pg_temp.chk('C6 — hay un estado marcado como compromiso público', v_n = 1, v_n::text);

  -- D1 -- las obras del PDOT existen y resuelven el arranque en frío -------
  select count(*) into v_n from public.obras where ciudad_id = v_ciudad and origen = 'pdot';
  perform pg_temp.chk('D1 — hay 40+ pedidos pre-cargados del PDOT', v_n >= 40, v_n::text);

  -- D2 -- ningún apoyo sale de la nada -------------------------------------
  -- El contador de cada obra tiene que cuadrar con sus votos reales. Es la
  -- forma robusta de comprobar que nadie fabrica apoyos: vale igual con la
  -- base recién sembrada que con meses de uso encima, y de paso detecta si el
  -- contador se desfasó por un cambio en los triggers.
  select count(*) into v_n
    from public.obras o
   where o.ciudad_id = v_ciudad
     and o.apoyos <> (select count(*) from public.votos v where v.obra_id = o.id);
  perform pg_temp.chk('D2 — ningún apoyo existe sin su voto detrás', v_n = 0, v_n || ' obras descuadradas');

  -- D3 -- todas citan su fuente --------------------------------------------
  select count(*) into v_n from public.obras
   where ciudad_id = v_ciudad and origen = 'pdot' and (fuente is null or trim(fuente) = '');
  perform pg_temp.chk('D3 — toda obra del PDOT cita el documento', v_n = 0, v_n || ' sin fuente');

  -- D4 -- están aprobadas (si no, nadie las ve) ----------------------------
  select count(*) into v_n from public.obras
   where ciudad_id = v_ciudad and origen = 'pdot' and not aprobada;
  perform pg_temp.chk('D4 — las obras del PDOT ya están publicadas', v_n = 0, v_n || ' sin aprobar');

  -- D5 -- ninguna tiene creador: no las pidió un vecino --------------------
  select count(*) into v_n from public.obras
   where ciudad_id = v_ciudad and origen = 'pdot' and creador_id is not null;
  perform pg_temp.chk('D5 — las obras del PDOT no se atribuyen a ningún vecino', v_n = 0, v_n::text);

  -- D6 -- el código corto para compartir se generó solo -------------------
  select count(*) into v_n from public.obras
   where ciudad_id = v_ciudad and (codigo is null or length(codigo) <> 6);
  perform pg_temp.chk('D6 — toda obra tiene su código de 6 letras para compartir', v_n = 0, v_n::text);

  select count(distinct codigo) into v_n from public.obras where ciudad_id = v_ciudad;
  perform pg_temp.chk('D7 — los códigos no se repiten',
    v_n = (select count(*) from public.obras where ciudad_id = v_ciudad), v_n::text);

  -- E1 -- las obras de pluvial cubren las ciudadelas que el PDOT señala ----
  select count(*) into v_n from public.obras o
    join public.categorias c on c.id = o.categoria_id
   where o.ciudad_id = v_ciudad and c.slug = 'pluvial' and o.origen = 'pdot';
  perform pg_temp.chk('E1 — hay 20+ pedidos de drenaje pluvial pre-cargados', v_n >= 20, v_n::text);

  -- E2 -- la advertencia técnica de que el drenaje va antes que el asfalto -
  select count(*) into v_n from public.obras o
    join public.categorias c on c.id = o.categoria_id
   where o.ciudad_id = v_ciudad and c.slug = 'vialidad'
     and o.descripcion ilike '%sin drenaje%';
  perform pg_temp.chk('E2 — los pedidos de adoquinado advierten que el drenaje va primero',
    v_n >= 1, v_n::text);

  -- F1 -- normalización de teléfonos ecuatorianos --------------------------
  perform pg_temp.chk('F1 — normaliza 0991234567',
    public.normalizar_telefono('0991234567') = '+593991234567',
    coalesce(public.normalizar_telefono('0991234567'), 'null'));
  perform pg_temp.chk('F2 — normaliza 991234567',
    public.normalizar_telefono('991234567') = '+593991234567',
    coalesce(public.normalizar_telefono('991234567'), 'null'));
  perform pg_temp.chk('F3 — normaliza +593 99 123 4567 con espacios',
    public.normalizar_telefono('+593 99 123 4567') = '+593991234567',
    coalesce(public.normalizar_telefono('+593 99 123 4567'), 'null'));
  perform pg_temp.chk('F4 — rechaza un fijo de Guayaquil (042345678)',
    public.normalizar_telefono('042345678') is null,
    coalesce(public.normalizar_telefono('042345678'), 'null'));
  perform pg_temp.chk('F5 — rechaza un número extranjero',
    public.normalizar_telefono('+1 415 555 0100') is null,
    coalesce(public.normalizar_telefono('+1 415 555 0100'), 'null'));

  -- G1 -- el slug quita tildes ---------------------------------------------
  perform pg_temp.chk('G1 — el slug quita tildes y eñes',
    public.slugificar('Genaro Maridueña') = 'genaro-maridue-a'
    or public.slugificar('Genaro Maridueña') = 'genaro-mariduena',
    public.slugificar('Genaro Maridueña'));
  perform pg_temp.chk('G2 — el slug de "Aníbal Zea 1" es limpio',
    public.slugificar('Aníbal Zea 1') = 'anibal-zea-1', public.slugificar('Aníbal Zea 1'));

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
  raise notice 'smoke-territorio — % en verde, % en rojo de %', v_total - v_fail, v_fail, v_total;
  if v_fail > 0 then
    raise exception 'smoke-territorio: % comprobaciones en rojo', v_fail;
  end if;
end;
$$;

rollback;
