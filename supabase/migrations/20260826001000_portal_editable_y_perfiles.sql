-- ============================================================================
-- El portal deja de ser algo que se toca en la base de datos y pasa a ser una
-- pantalla del panel. Tres cosas entran aquí:
--
--   1. Campos nuevos del hero: el recorte del candidato que se ve a la derecha,
--      la cédula (obligatoria en propaganda electoral en Ecuador) y el
--      subtítulo, que hasta ahora estaba escrito a mano en el componente.
--   2. La tabla de perfiles: el equipo detrás del portal, cada uno con su
--      ficha pública. Antes «Equipo» era una sola persona incrustada en portal.
--   3. Las RPC de escritura del panel, incluida la que le deja al equipo
--      publicar un pedido por su cuenta sin pasar por la cola.
-- ============================================================================

-- ------------------------------------------------------------------ portal --
alter table public.portal
  add column if not exists foto_hero_url  text,
  add column if not exists cedula         text,
  add column if not exists hero_subtitulo text not null default '',
  add column if not exists hero_medio     text not null default 'foto'
    check (hero_medio in ('foto', 'video'));

comment on column public.portal.foto_hero_url is 'Recorte del candidato que va a la derecha del hero, idealmente sin fondo.';
comment on column public.portal.cedula is 'Se muestra junto al nombre. La propaganda electoral en Ecuador la exige.';
comment on column public.portal.hero_medio is 'Qué acompaña al hero: la foto recortada o el video de presentación.';

-- ---------------------------------------------------------------- perfiles --
-- La ficha de cada persona del equipo. Es contenido público y de solo lectura
-- para el vecino: se administra desde el panel por RPC, como todo lo demás.
create table if not exists public.perfiles (
  id           uuid primary key default gen_random_uuid(),
  ciudad_id    uuid not null references public.ciudades (id) on delete cascade,
  slug         text not null,
  nombre       text not null check (length(trim(nombre)) between 2 and 80),
  cargo        text not null default '',
  cedula       text,
  foto_url     text,
  bio          text not null default '',
  telefono     text,
  correo       text,
  redes        jsonb not null default '{}'::jsonb,
  es_candidato boolean not null default false,
  orden        integer not null default 0,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  unique (ciudad_id, slug)
);

comment on table public.perfiles is 'Las personas del portal. El candidato es una más, marcada con es_candidato.';
comment on column public.perfiles.telefono is 'Contacto público del equipo, no de un vecino. Se muestra tal cual si está.';

create index if not exists idx_perfiles_ciudad on public.perfiles (ciudad_id, activo, orden);

alter table public.perfiles enable row level security;

drop policy if exists "los perfiles activos son públicos" on public.perfiles;
create policy "los perfiles activos son públicos"
  on public.perfiles for select
  using (activo or public.es_del_equipo(ciudad_id));

-- Sin políticas de escritura: se administran por RPC en security definer.

-- ============================================================================
-- Lectura pública
-- ============================================================================

create or replace function public.portal_perfiles(p_ciudad_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ciudad_id uuid;
begin
  select id into v_ciudad_id from public.ciudades where slug = p_ciudad_slug and activa;
  if v_ciudad_id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudad_no_encontrada');
  end if;

  return jsonb_build_object(
    'success', true,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id, 'slug', p.slug, 'nombre', p.nombre, 'cargo', p.cargo,
          'foto_url', p.foto_url, 'es_candidato', p.es_candidato,
          -- En la lista va solo el arranque de la biografía: la ficha completa
          -- se lee al entrar, y así la portada no arrastra kilos de texto.
          'resumen', left(regexp_replace(p.bio, '\s+', ' ', 'g'), 140)
        ) order by p.es_candidato desc, p.orden, p.nombre
      )
      from public.perfiles p
      where p.ciudad_id = v_ciudad_id and p.activo
    ), '[]'::jsonb)
  );
end;
$$;
comment on function public.portal_perfiles is 'Lista de fichas del equipo para la página pública de perfiles.';

create or replace function public.portal_perfil(p_ciudad_slug text, p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ciudad_id uuid;
  v_perfil    public.perfiles;
begin
  select id into v_ciudad_id from public.ciudades where slug = p_ciudad_slug and activa;
  if v_ciudad_id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudad_no_encontrada');
  end if;

  select * into v_perfil
    from public.perfiles
   where ciudad_id = v_ciudad_id and slug = p_slug and activo;

  if v_perfil.id is null then
    return jsonb_build_object('success', false, 'error_code', 'perfil_no_encontrado');
  end if;

  return jsonb_build_object(
    'success', true,
    'perfil', jsonb_build_object(
      'id', v_perfil.id, 'slug', v_perfil.slug, 'nombre', v_perfil.nombre,
      'cargo', v_perfil.cargo, 'cedula', v_perfil.cedula, 'foto_url', v_perfil.foto_url,
      'bio', v_perfil.bio, 'telefono', v_perfil.telefono, 'correo', v_perfil.correo,
      'redes', v_perfil.redes, 'es_candidato', v_perfil.es_candidato
    )
  );
end;
$$;
comment on function public.portal_perfil is 'Ficha completa de una persona del equipo, por slug.';

-- El portal de la portada gana los campos nuevos del hero. Se reescribe entera
-- porque `ciudad_portada` construye el jsonb campo a campo.
create or replace function public.ciudad_portada(p_ciudad_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ciudad public.ciudades;
  v_portal public.portal;
  v_total_vecinos integer;
  v_total_obras   integer;
  v_total_apoyos  integer;
begin
  select * into v_ciudad from public.ciudades where slug = p_ciudad_slug and activa;
  if v_ciudad.id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudad_no_encontrada');
  end if;

  select * into v_portal from public.portal where ciudad_id = v_ciudad.id;

  select count(*)::integer into v_total_vecinos from public.vecinos where ciudad_id = v_ciudad.id;
  select count(*)::integer into v_total_obras from public.obras
   where ciudad_id = v_ciudad.id and aprobada and fusionada_en is null;
  select coalesce(sum(apoyos), 0)::integer into v_total_apoyos from public.obras
   where ciudad_id = v_ciudad.id and aprobada and fusionada_en is null;

  return jsonb_build_object(
    'success', true,
    'ciudad', jsonb_build_object(
      'id', v_ciudad.id, 'slug', v_ciudad.slug, 'nombre', v_ciudad.nombre,
      'provincia', v_ciudad.provincia, 'modo', v_ciudad.modo,
      'poblacion_urbana', v_ciudad.poblacion_urbana
    ),
    'portal', case when v_portal.ciudad_id is null then null else
      jsonb_build_object(
        'candidato_nombre', v_portal.candidato_nombre,
        'candidato_cargo', v_portal.candidato_cargo,
        'partido', v_portal.partido,
        'cedula', v_portal.cedula,
        'eslogan', v_portal.eslogan,
        'hero_subtitulo', v_portal.hero_subtitulo,
        'hero_medio', v_portal.hero_medio,
        'bio', v_portal.bio,
        'foto_url', v_portal.foto_url,
        'foto_hero_url', v_portal.foto_hero_url,
        'banner_url', v_portal.banner_url,
        'video_url', v_portal.video_url,
        'video_portada_url', v_portal.video_portada_url,
        'logo_url', v_portal.logo_url,
        'color_marca', v_portal.color_marca,
        'redes', v_portal.redes
      ) end,
    'cifras', jsonb_build_object(
      'vecinos', v_total_vecinos,
      'obras', v_total_obras,
      'apoyos', v_total_apoyos
    )
  );
end;
$$;

-- ============================================================================
-- Escritura del panel
-- ============================================================================

create or replace function public.admin_portal_guardar(
  p_ciudad_id uuid,
  p_datos     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_medio text := coalesce(nullif(p_datos ->> 'hero_medio', ''), 'foto');
begin
  if not public.puede_editar(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  if v_medio not in ('foto', 'video') then
    return jsonb_build_object('success', false, 'error_code', 'hero_medio_invalido');
  end if;

  -- Un portal puede no existir todavía si la ciudad se creó a mano. El upsert
  -- evita que el equipo se encuentre con un formulario que guarda en la nada.
  insert into public.portal (ciudad_id) values (p_ciudad_id)
  on conflict (ciudad_id) do nothing;

  -- Cada campo con coalesce sobre el valor actual: el panel puede enviar el
  -- formulario entero o solo la pestaña que tocó, y en ningún caso borra lo
  -- que no venía. Para vaciar un texto se envía la cadena vacía, que sí pasa.
  update public.portal set
    candidato_nombre  = coalesce(p_datos ->> 'candidato_nombre', candidato_nombre),
    candidato_cargo   = coalesce(p_datos ->> 'candidato_cargo', candidato_cargo),
    partido           = coalesce(p_datos ->> 'partido', partido),
    cedula            = coalesce(p_datos ->> 'cedula', cedula),
    eslogan           = coalesce(p_datos ->> 'eslogan', eslogan),
    hero_subtitulo    = coalesce(p_datos ->> 'hero_subtitulo', hero_subtitulo),
    hero_medio        = v_medio,
    bio               = coalesce(p_datos ->> 'bio', bio),
    -- Las urls sí admiten null explícito: así se quita una foto cargada.
    foto_url          = case when p_datos ? 'foto_url' then nullif(p_datos ->> 'foto_url', '') else foto_url end,
    foto_hero_url     = case when p_datos ? 'foto_hero_url' then nullif(p_datos ->> 'foto_hero_url', '') else foto_hero_url end,
    banner_url        = case when p_datos ? 'banner_url' then nullif(p_datos ->> 'banner_url', '') else banner_url end,
    video_url         = case when p_datos ? 'video_url' then nullif(p_datos ->> 'video_url', '') else video_url end,
    video_portada_url = case when p_datos ? 'video_portada_url' then nullif(p_datos ->> 'video_portada_url', '') else video_portada_url end,
    logo_url          = case when p_datos ? 'logo_url' then nullif(p_datos ->> 'logo_url', '') else logo_url end,
    color_marca       = coalesce(nullif(p_datos ->> 'color_marca', ''), color_marca),
    redes             = coalesce(p_datos -> 'redes', redes),
    actualizado_en    = now()
  where ciudad_id = p_ciudad_id;

  perform public.anotar_bitacora(p_ciudad_id, 'guardar_portal', 'portal', null, '{}'::jsonb);

  return jsonb_build_object('success', true);
end;
$$;
comment on function public.admin_portal_guardar is 'Guarda la cara pública del portal desde el panel. Campos ausentes no se tocan.';

create or replace function public.admin_perfiles_guardar(
  p_ciudad_id uuid,
  p_perfiles  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_ids  uuid[] := '{}';
  v_id   uuid;
  v_slug text;
  v_orden integer := 0;
begin
  if not public.puede_editar(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  for v_item in select * from jsonb_array_elements(p_perfiles) loop
    if length(trim(coalesce(v_item ->> 'nombre', ''))) < 2 then
      return jsonb_build_object('success', false, 'error_code', 'nombre_muy_corto');
    end if;

    -- El slug se congela al crear: es la url pública de la ficha y cambiarla
    -- al renombrar a alguien rompería los enlaces que ya circulan por WhatsApp.
    v_slug := coalesce(nullif(v_item ->> 'slug', ''), public.slugificar(v_item ->> 'nombre'));

    if (v_item ->> 'id') is not null and (v_item ->> 'id') <> '' then
      v_id := (v_item ->> 'id')::uuid;
      update public.perfiles set
        nombre       = trim(v_item ->> 'nombre'),
        cargo        = coalesce(v_item ->> 'cargo', ''),
        cedula       = nullif(v_item ->> 'cedula', ''),
        foto_url     = nullif(v_item ->> 'foto_url', ''),
        bio          = coalesce(v_item ->> 'bio', ''),
        telefono     = nullif(v_item ->> 'telefono', ''),
        correo       = nullif(v_item ->> 'correo', ''),
        redes        = coalesce(v_item -> 'redes', '{}'::jsonb),
        es_candidato = coalesce((v_item ->> 'es_candidato')::boolean, false),
        orden        = v_orden,
        activo       = true
      where id = v_id and ciudad_id = p_ciudad_id;
    else
      insert into public.perfiles (
        ciudad_id, slug, nombre, cargo, cedula, foto_url, bio,
        telefono, correo, redes, es_candidato, orden
      ) values (
        p_ciudad_id, v_slug, trim(v_item ->> 'nombre'),
        coalesce(v_item ->> 'cargo', ''), nullif(v_item ->> 'cedula', ''),
        nullif(v_item ->> 'foto_url', ''), coalesce(v_item ->> 'bio', ''),
        nullif(v_item ->> 'telefono', ''), nullif(v_item ->> 'correo', ''),
        coalesce(v_item -> 'redes', '{}'::jsonb),
        coalesce((v_item ->> 'es_candidato')::boolean, false), v_orden
      )
      -- Alguien que se quitó del equipo y vuelve: se revive su ficha en vez de
      -- reventar por slug repetido, igual que con los estados.
      on conflict (ciudad_id, slug) do update
        set nombre = excluded.nombre, cargo = excluded.cargo, cedula = excluded.cedula,
            foto_url = excluded.foto_url, bio = excluded.bio, telefono = excluded.telefono,
            correo = excluded.correo, redes = excluded.redes,
            es_candidato = excluded.es_candidato, orden = excluded.orden, activo = true
      returning id into v_id;
    end if;

    v_ids := array_append(v_ids, v_id);
    v_orden := v_orden + 1;
  end loop;

  -- Los que ya no vienen se ocultan, nunca se borran: sus enlaces siguen
  -- circulando y preferimos un 404 controlado a perder el historial.
  update public.perfiles
     set activo = false
   where ciudad_id = p_ciudad_id
     and (array_length(v_ids, 1) is null or not (id = any (v_ids)));

  perform public.anotar_bitacora(p_ciudad_id, 'guardar_perfiles', 'perfiles', null,
                                 jsonb_build_object('total', coalesce(array_length(v_ids, 1), 0)));

  return jsonb_build_object('success', true, 'ids', to_jsonb(v_ids));
end;
$$;
comment on function public.admin_perfiles_guardar is 'Guarda la lista completa de fichas del equipo. El orden del array es el orden en pantalla.';

create or replace function public.admin_perfiles_listar(p_ciudad_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_del_equipo(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  return jsonb_build_object(
    'success', true,
    'items', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.es_candidato desc, p.orden, p.nombre)
      from public.perfiles p
      where p.ciudad_id = p_ciudad_id and p.activo
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------- admin_obra_crear --
-- El equipo también levanta pedidos: los que llegan por la asamblea del barrio,
-- por teléfono o porque el candidato los vio al caminar la ciudadela. Entran
-- publicados, sin pasar por la cola — ya vienen revisados por definición — y
-- marcados con origen 'equipo' para no inflar la métrica de demanda ciudadana.
create or replace function public.admin_obra_crear(
  p_ciudadela_id uuid,
  p_categoria_id uuid,
  p_titulo       text,
  p_descripcion  text default '',
  p_foto_url     text default null,
  p_fuente       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ciudad_id uuid;
  v_estado    uuid;
  v_obra      public.obras;
begin
  select ciudad_id into v_ciudad_id from public.ciudadelas where id = p_ciudadela_id;
  if v_ciudad_id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudadela_invalida');
  end if;

  if not public.puede_editar(v_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  if length(trim(coalesce(p_titulo, ''))) < 8 then
    return jsonb_build_object('success', false, 'error_code', 'titulo_muy_corto');
  end if;

  if not exists (
    select 1 from public.categorias ct
     where ct.id = p_categoria_id and ct.ciudad_id = v_ciudad_id and ct.activa
  ) then
    return jsonb_build_object('success', false, 'error_code', 'categoria_invalida');
  end if;

  select e.id into v_estado
    from public.estados e
   where e.ciudad_id = v_ciudad_id and e.es_inicial and e.activo;
  if v_estado is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_estado_inicial');
  end if;

  insert into public.obras (
    ciudad_id, ciudadela_id, categoria_id, estado_id,
    titulo, descripcion, foto_url, origen, fuente,
    aprobada, aprobada_en, aprobada_por
  ) values (
    v_ciudad_id, p_ciudadela_id, p_categoria_id, v_estado,
    trim(p_titulo), coalesce(trim(p_descripcion), ''), p_foto_url, 'equipo',
    nullif(trim(coalesce(p_fuente, '')), ''),
    true, now(), auth.uid()
  )
  returning * into v_obra;

  perform public.anotar_bitacora(v_ciudad_id, 'crear_obra', 'obras', v_obra.id,
                                 jsonb_build_object('titulo', v_obra.titulo));

  return jsonb_build_object(
    'success', true,
    'obra', jsonb_build_object('id', v_obra.id, 'codigo', v_obra.codigo, 'aprobada', true)
  );
end;
$$;
comment on function public.admin_obra_crear is 'Pedido levantado por el equipo. Nace publicado y con origen equipo, con cero apoyos.';

-- ============================================================================
-- Permisos
-- ============================================================================

grant execute on function public.ciudad_portada(text)         to anon, authenticated;
grant execute on function public.portal_perfiles(text)        to anon, authenticated;
grant execute on function public.portal_perfil(text, text)    to anon, authenticated;

grant execute on function public.admin_portal_guardar(uuid, jsonb)   to authenticated;
grant execute on function public.admin_perfiles_guardar(uuid, jsonb) to authenticated;
grant execute on function public.admin_perfiles_listar(uuid)         to authenticated;
grant execute on function public.admin_obra_crear(uuid, uuid, text, text, text, text) to authenticated;

-- Las migraciones corren como `postgres`, no como `supabase_admin`: los grants
-- por defecto de Supabase no aplican y sin esta línea la tabla nueva responde
-- «permission denied» a todo el mundo aunque la RLS la deje pasar.
grant select on public.perfiles to anon, authenticated;

-- Las RPC admin_* de esta migración nacen, como todas, con EXECUTE para PUBLIC.
-- Se cierran igual que las de la migración de permisos.
select public.cerrar_funciones_admin();
