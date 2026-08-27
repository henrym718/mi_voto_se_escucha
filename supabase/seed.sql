-- ============================================================================
-- Seed del piloto: cantón El Triunfo, provincia del Guayas.
--
-- Las ciudadelas salen del PDOT 2019-2023 y del Plan de Trabajo del GAD
-- Municipal (marcadas verificado = true) y de OpenStreetMap (verificado =
-- false, por confirmar con alguien local).
--
-- Las obras pre-cargadas NO son inventadas ni tienen votos simulados: son las
-- carencias que el propio PDOT documenta, con la fuente citada y cero apoyos.
-- Resuelven el arranque en frío sin mentir: el vecino entra y encuentra su
-- problema listo para apoyar en un toque, en vez de una página en blanco.
-- ============================================================================

do $seed$
declare
  v_ciudad uuid;
  v_est_recibida uuid;
  v_est_revision uuid;
  v_est_visitada uuid;
  v_est_comprometida uuid;
  v_est_estudio uuid;
  v_est_plurianual uuid;
  v_cat_pluvial uuid;
  v_cat_sanitario uuid;
  v_cat_vialidad uuid;
  v_cat_agua uuid;
  v_ciudadela uuid;
  v_nombre text;
  v_sin_pluvial text[] := array[
    'Nueva Jerusalén','Agua Santa 1','Agua Santa 2','Santa Marianita','Aníbal Zea 1','Aníbal Zea 2',
    'Aníbal Zea Empleados','Triunfo 87','Huancavilca','San Pedro 1','San Pedro 2','San Pedro 3',
    'Santa Zoila','Che Guevara','Jaime Roldós','Río Verde','Divino Niño','San Jacinto 1','San Jacinto 2',
    'Patria Nueva A','Patria Nueva B','Patria Nueva C','La Paz','Nuevo Amanecer 1','Nuevo Amanecer 2'
  ];
  v_sin_sanitario text[] := array[
    'Arbolito 2','Arbolito 3','San Fernando','Nueva Jerusalén','Agua Santa 1','Santa Marianita',
    'Jaime Hurtado 1','Jaime Hurtado 2','Lotización La Cartonera','Triunfo 87','Nuevo Amanecer 1'
  ];
  v_lastre text[] := array[
    'Arbolito 1','Arbolito 2','Arbolito 3','La Paz','Patria Nueva A','Patria Nueva D','El Rocío',
    'Cristo Peregrino','Lotización La Cartonera','Santa Zoila','Che Guevara','Nuevo Amanecer 2'
  ];
begin

-- ---------------------------------------------------------------- ciudad --
insert into public.ciudades (slug, nombre, provincia, poblacion_urbana, modo)
values ('el-triunfo', 'El Triunfo', 'Guayas', 41042, 'campana')
returning id into v_ciudad;

insert into public.portal (
  ciudad_id, candidato_nombre, candidato_cargo, partido, cedula,
  eslogan, hero_subtitulo, hero_medio, foto_hero_url, bio, color_marca
) values (
  v_ciudad,
  'Nombre del candidato',
  'Candidato a la Alcaldía de El Triunfo',
  'Movimiento político',
  '0900000000',
  'El Triunfo lo decidimos entre todos',
  'Pide la obra que le hace falta a tu barrio y apoya las de tus vecinos. Las más apoyadas entran al plan de obras.',
  'foto',
  -- Silueta de relleno para que el hero se vea completo antes de que el equipo
  -- suba el recorte real. Se reemplaza desde el panel, en Portada y perfiles.
  '/ejemplo-recorte-candidato.svg',
  'Escribe aquí la presentación del candidato desde el panel de administración. Este texto y todas las imágenes se cargan sin tocar código.',
  '#0d7d6c'
);

-- Sin fichas cargadas, la página de perfiles cae en la ficha del candidato
-- armada con lo de arriba. Aquí se siembra la del candidato para que el equipo
-- vea la lista de ejemplo el primer día y sepa qué tiene que llenar.
insert into public.perfiles (
  ciudad_id, slug, nombre, cargo, cedula, bio, es_candidato, orden
) values (
  v_ciudad, 'candidato', 'Nombre del candidato', 'Candidato a la Alcaldía de El Triunfo',
  '0900000000',
  'Escribe aquí quién es, a qué se ha dedicado y por qué se presenta. Dos o tres párrafos alcanzan.',
  true, 0
);

-- ------------------------------------------------------------ categorías --
-- Ordenadas por el déficit real documentado en el PDOT, no alfabéticamente.
insert into public.categorias (ciudad_id, nombre, slug, icono, color, orden) values
  (v_ciudad, 'Alcantarillado pluvial', 'pluvial',    'cloud-rain',   '#2f6fb5', 1),
  (v_ciudad, 'Alcantarillado sanitario','sanitario', 'waves',        '#0d7d6c', 2),
  (v_ciudad, 'Calles y adoquinado',    'vialidad',   'route',        '#8a6a3d', 3),
  (v_ciudad, 'Agua potable',           'agua',       'droplets',     '#2596be', 4),
  (v_ciudad, 'Aceras y bordillos',     'aceras',     'footprints',   '#9a7b4f', 5),
  (v_ciudad, 'Recolección de basura',  'basura',     'trash-2',      '#5c7a4a', 6),
  (v_ciudad, 'Parques y canchas',      'parques',    'trees',        '#3f8f5b', 7),
  (v_ciudad, 'Alumbrado público',      'alumbrado',  'lightbulb',    '#c98a12', 8),
  (v_ciudad, 'Seguridad',              'seguridad',  'shield',       '#a4443c', 9),
  (v_ciudad, 'Vías rurales y puentes', 'rural',      'tractor',      '#7a6a55', 10);

select id into v_cat_pluvial   from public.categorias where ciudad_id = v_ciudad and slug = 'pluvial';
select id into v_cat_sanitario from public.categorias where ciudad_id = v_ciudad and slug = 'sanitario';
select id into v_cat_vialidad  from public.categorias where ciudad_id = v_ciudad and slug = 'vialidad';
select id into v_cat_agua      from public.categorias where ciudad_id = v_ciudad and slug = 'agua';

-- --------------------------------------------------------------- estados --
-- Plantilla de CAMPAÑA. No existe "No viable": ningún candidato publica eso
-- en su propia página. Los dos cierres suaves cumplen la misma función de que
-- nada quede en silencio, sin costo político.
insert into public.estados (ciudad_id, nombre, slug, descripcion, color, orden, es_inicial, es_compromiso, es_cierre_suave) values
  (v_ciudad, 'Recibida', 'recibida',
   'Tu pedido ya está publicado y sumando apoyos.', '#8b8993', 1, true, false, false),
  (v_ciudad, 'En revisión', 'revision',
   'El equipo está revisando el caso con los vecinos del sector.', '#4a90a4', 2, false, false, false),
  (v_ciudad, 'Visitada', 'visitada',
   'El candidato estuvo en el sitio y conversó con los vecinos.', '#1f7a4d', 3, false, false, false),
  (v_ciudad, 'Comprometida', 'comprometida',
   'Esta obra entra en el plan de gobierno.', '#c98a12', 4, false, true, false),
  (v_ciudad, 'En estudio técnico', 'estudio-tecnico',
   'Requiere estudios previos antes de poder ejecutarse.', '#7a6a9a', 5, false, false, true),
  (v_ciudad, 'Proyectada a mediano plazo', 'mediano-plazo',
   'Está contemplada, pero depende de obras previas o de presupuesto plurianual.', '#8a7f6a', 6, false, false, true);

select id into v_est_recibida     from public.estados where ciudad_id = v_ciudad and slug = 'recibida';
select id into v_est_revision     from public.estados where ciudad_id = v_ciudad and slug = 'revision';
select id into v_est_visitada     from public.estados where ciudad_id = v_ciudad and slug = 'visitada';
select id into v_est_comprometida from public.estados where ciudad_id = v_ciudad and slug = 'comprometida';

-- ------------------------------------------------------------ ciudadelas --
-- Bloque 1: confirmadas por documento municipal (PDOT / Plan de Trabajo).
insert into public.ciudadelas (ciudad_id, nombre, slug, zona, verificado, fuente, orden)
select v_ciudad, n, public.slugificar(n), 'urbana', true,
       'PDOT El Triunfo 2019-2023 / Plan de Trabajo GAD Municipal', row_number() over ()
  from unnest(array[
    'Las Palmas 1','Las Palmas 2','Assad Bucaram','Barrio Colonial','Barrio 17 de Septiembre',
    'Lotización Mosquera','Velasco Ibarra','Cooperativa Patria Nueva','12 de Agosto','La Victoria',
    'San José','Pedro Menéndez Sector A','Pedro Menéndez Sector B','Abdón Calderón','Genaro Maridueña',
    'Santa Rosita','6 de Julio','María Auxiliadora','Primavera','Inga','El Paraíso',
    'Arbolito 2','Arbolito 3','San Fernando','Aníbal Zea 1','Aníbal Zea 2','Aníbal Zea Empleados',
    'San Pedro 1','San Pedro 2','San Pedro 3','La Carmela 1','La Carmela 2','Primero de Mayo',
    'Río Guayas','Yolanda Vallejo','Río Verde','Huancavilca','Jaime Roldós','Santa Zoila',
    'Che Guevara','Nuevo Amanecer 1','Nuevo Amanecer 2','Agua Santa 1','Agua Santa 2',
    'Guayaquil','Yaguachi','Bellavista','Blanca Coello','Isabel','Virgen del Cisne','25 de Agosto',
    'Jaime Hurtado 1','Jaime Hurtado 2','Nueva Jerusalén','Santa Marianita','Triunfo 87',
    'Divino Niño','San Jacinto 1','San Jacinto 2','Centro Poblado Río Verde',
    'Patria Nueva A','Patria Nueva B','Patria Nueva C','La Paz'
  ]) as n;

-- Bloque 2: solo en OpenStreetMap. Se muestran, pero marcadas por verificar.
insert into public.ciudadelas (ciudad_id, nombre, slug, zona, verificado, fuente, orden)
select v_ciudad, n, public.slugificar(n), 'urbana', false,
       'OpenStreetMap — por confirmar con fuente local', 100 + row_number() over ()
  from unnest(array[
    'Arbolito 1','Lotización La Cartonera','El Muro de Berlín','Santa Rosa','Patria Nueva D',
    'El Rocío','El Chófer','Cristo Peregrino','Lotización Lenín Moreno Garcés','Lotización Pedro Ricardo'
  ]) as n;

-- Sector funcional: "Centro" no es una ciudadela documentada, pero es de uso
-- corriente. Se ofrece marcado como sector, no como ciudadela con respaldo.
insert into public.ciudadelas (ciudad_id, nombre, slug, zona, verificado, fuente, orden)
values (v_ciudad, 'Centro', 'centro', 'funcional', false,
        'Uso local corriente; los documentos municipales lo llaman casco urbano', 200);

-- ================================================================== obras ==
-- Pre-cargadas desde el PDOT. Cero apoyos: los pone la gente.

-- 1. Ciudadelas sin alcantarillado pluvial (76,44 % del total según el PDOT).
foreach v_nombre in array v_sin_pluvial loop
  select id into v_ciudadela from public.ciudadelas
   where ciudad_id = v_ciudad and slug = public.slugificar(v_nombre);
  if v_ciudadela is not null then
    insert into public.obras (
      ciudad_id, ciudadela_id, categoria_id, estado_id, titulo, descripcion,
      origen, fuente, aprobada, aprobada_en
    ) values (
      v_ciudad, v_ciudadela, v_cat_pluvial, v_est_recibida,
      'Alcantarillado pluvial en ' || v_nombre,
      'Cuando llueve, las calles de ' || v_nombre || ' se inundan porque el sector no tiene drenaje. '
      || 'El plan municipal reconoce esta carencia. Apoya este pedido para que suba en la lista de prioridades del barrio.',
      'pdot',
      'PDOT El Triunfo 2019-2023: el 76,44 % de las ciudadelas no cuenta con alcantarillado pluvial.',
      true, now()
    );
  end if;
end loop;

-- 2. Sectores sin alcantarillado sanitario.
foreach v_nombre in array v_sin_sanitario loop
  select id into v_ciudadela from public.ciudadelas
   where ciudad_id = v_ciudad and slug = public.slugificar(v_nombre);
  if v_ciudadela is not null then
    insert into public.obras (
      ciudad_id, ciudadela_id, categoria_id, estado_id, titulo, descripcion,
      origen, fuente, aprobada, aprobada_en
    ) values (
      v_ciudad, v_ciudadela, v_cat_sanitario, v_est_recibida,
      'Alcantarillado sanitario en ' || v_nombre,
      'El sector no está conectado a la red pública de aguas servidas y depende de pozos sépticos. '
      || 'Apoya este pedido para que la ampliación de la red llegue a ' || v_nombre || '.',
      'pdot',
      'PDOT El Triunfo 2019-2023: cobertura urbana de alcantarillado sanitario del 63,96 %; las ciudadelas periféricas siguen sin servicio.',
      true, now()
    );
  end if;
end loop;

-- 3. Calles de lastre pendientes de adoquinado.
foreach v_nombre in array v_lastre loop
  select id into v_ciudadela from public.ciudadelas
   where ciudad_id = v_ciudad and slug = public.slugificar(v_nombre);
  if v_ciudadela is not null then
    insert into public.obras (
      ciudad_id, ciudadela_id, categoria_id, estado_id, titulo, descripcion,
      origen, fuente, aprobada, aprobada_en
    ) values (
      v_ciudad, v_ciudadela, v_cat_vialidad, v_est_recibida,
      'Adoquinado de las calles de ' || v_nombre,
      'Las calles del sector son de lastre y se vuelven intransitables en invierno. '
      || 'Ojo: el plan municipal advierte que sin drenaje pluvial no se puede adoquinar, así que las dos obras van juntas.',
      'pdot',
      'PDOT El Triunfo 2019-2023: el 80,39 % del viario urbano es lastrado. La falta de drenaje impide el mejoramiento vial.',
      true, now()
    );
  end if;
end loop;

-- 4. Agua potable rural: una sola planta compacta para varios recintos.
select id into v_ciudadela from public.ciudadelas where ciudad_id = v_ciudad and slug = 'centro';
insert into public.obras (
  ciudad_id, ciudadela_id, categoria_id, estado_id, titulo, descripcion,
  origen, fuente, aprobada, aprobada_en
) values (
  v_ciudad, v_ciudadela, v_cat_agua, v_est_recibida,
  'Agua potable apta para consumo en la zona rural',
  'La zona rural depende de una sola planta compacta y el propio municipio reconoce que el agua captada no es apta para consumo humano. '
  || 'Apoya este pedido si vives o trabajas en los recintos.',
  'pdot',
  'PDOT El Triunfo 2019-2023: "los sectores que actualmente reciben este servicio están insatisfechos… el agua que se capta no es apta para el consumo humano".',
  true, now()
);

end
$seed$;

-- ============================================================================
-- Cuentas de prueba SOLO para desarrollo local.
--
-- Nada de esto llega a la nube: en staging y producción el pipeline crea la
-- cuenta del equipo con un script propio y una clave que vive en los secretos
-- de GitHub. Aquí existe para poder abrir el panel sin trámite.
--
--   admin@local.test    / local1234   -> puede todo
--   editor@local.test   / local1234   -> contenido y estados
--   candidato@local.test/ local1234   -> solo mira sus métricas
-- ============================================================================

do $cuentas$
declare
  v_ciudad uuid;
  v_id     uuid;
  v_rol    text;
  v_correo text;
begin
  select id into v_ciudad from public.ciudades where slug = 'el-triunfo';

  foreach v_rol in array array['admin', 'editor', 'candidato'] loop
    v_id := gen_random_uuid();
    v_correo := v_rol || '@local.test';

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      -- gotrue lee estas columnas al iniciar sesión y falla con "Database error
      -- querying schema" si las encuentra en NULL. Van en cadena vacía, que es
      -- como las deja el registro normal por la API.
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_correo, extensions.crypt('local1234', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at
    ) values (
      gen_random_uuid(), v_id, v_id::text, 'email',
      jsonb_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true),
      now(), now(), now()
    );

    insert into public.admins (id, ciudad_id, rol, nombre)
    values (v_id, v_ciudad, v_rol, initcap(v_rol) || ' de prueba');
  end loop;
end
$cuentas$;
