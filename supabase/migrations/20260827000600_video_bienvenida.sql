-- ============================================================================
-- El video que explica de qué va esto, una sola vez.
--
-- La plataforma se entiende sola una vez dentro, pero el primer segundo es el
-- caro: alguien llega desde un enlace de WhatsApp sin saber si esto es una
-- encuesta, una campaña o un trámite. Treinta segundos del candidato diciendo
-- «esto sirve para pedir la obra de tu barrio y apoyar la de tus vecinos»
-- resuelven esa duda mejor que cualquier texto.
--
-- Va en su propia columna y no en `video_url`, que es otra cosa: ese es el
-- mensaje del candidato, un botón que el vecino toca si quiere. Este se abre
-- solo. Mezclarlos obligaría a elegir entre los dos.
--
-- Si el campo está vacío no aparece nada. Es la única forma sensata de tratar
-- una interrupción: quien no la configura, no la tiene.
-- ============================================================================

alter table public.portal add column if not exists video_bienvenida_url text;

comment on column public.portal.video_bienvenida_url is
  'Enlace de YouTube que se abre solo la primera visita y explica para qué sirve la plataforma. Vacío = no aparece nada.';

-- ------------------------------------------------------------ ciudad_portada --
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
        'hero_candidato', v_portal.hero_candidato,
        'bio', v_portal.bio,
        'foto_url', v_portal.foto_url,
        'foto_hero_url', v_portal.foto_hero_url,
        'banner_url', v_portal.banner_url,
        'video_url', v_portal.video_url,
        'video_portada_url', v_portal.video_portada_url,
        'video_bienvenida_url', v_portal.video_bienvenida_url,
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

-- ------------------------------------------------------- admin_portal_guardar --
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
  v_medio      text := coalesce(nullif(p_datos ->> 'hero_medio', ''), 'foto');
  v_bienvenida text;
begin
  if not public.puede_editar(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  if v_medio not in ('foto', 'video') then
    return jsonb_build_object('success', false, 'error_code', 'hero_medio_invalido');
  end if;

  -- Acaba dentro de un iframe que se abre solo delante de todo el que entra.
  -- La lista blanca se comprueba aquí y no solo en el formulario del panel.
  if p_datos ? 'video_bienvenida_url' then
    v_bienvenida := nullif(trim(p_datos ->> 'video_bienvenida_url'), '');
    if v_bienvenida is not null and not public.es_enlace_youtube(v_bienvenida) then
      return jsonb_build_object('success', false, 'error_code', 'video_no_es_youtube');
    end if;
  end if;

  insert into public.portal (ciudad_id) values (p_ciudad_id)
  on conflict (ciudad_id) do nothing;

  update public.portal set
    candidato_nombre  = coalesce(p_datos ->> 'candidato_nombre', candidato_nombre),
    candidato_cargo   = coalesce(p_datos ->> 'candidato_cargo', candidato_cargo),
    partido           = coalesce(p_datos ->> 'partido', partido),
    cedula            = coalesce(p_datos ->> 'cedula', cedula),
    eslogan           = coalesce(p_datos ->> 'eslogan', eslogan),
    hero_subtitulo    = coalesce(p_datos ->> 'hero_subtitulo', hero_subtitulo),
    hero_medio        = v_medio,
    hero_candidato    = case when p_datos ? 'hero_candidato'
                             then coalesce((p_datos ->> 'hero_candidato')::boolean, false)
                             else hero_candidato end,
    bio               = coalesce(p_datos ->> 'bio', bio),
    foto_url          = case when p_datos ? 'foto_url' then nullif(p_datos ->> 'foto_url', '') else foto_url end,
    foto_hero_url     = case when p_datos ? 'foto_hero_url' then nullif(p_datos ->> 'foto_hero_url', '') else foto_hero_url end,
    banner_url        = case when p_datos ? 'banner_url' then nullif(p_datos ->> 'banner_url', '') else banner_url end,
    video_url         = case when p_datos ? 'video_url' then nullif(p_datos ->> 'video_url', '') else video_url end,
    video_portada_url = case when p_datos ? 'video_portada_url' then nullif(p_datos ->> 'video_portada_url', '') else video_portada_url end,
    video_bienvenida_url = case when p_datos ? 'video_bienvenida_url' then v_bienvenida else video_bienvenida_url end,
    logo_url          = case when p_datos ? 'logo_url' then nullif(p_datos ->> 'logo_url', '') else logo_url end,
    color_marca       = coalesce(nullif(p_datos ->> 'color_marca', ''), color_marca),
    redes             = coalesce(p_datos -> 'redes', redes),
    actualizado_en    = now()
  where ciudad_id = p_ciudad_id;

  perform public.anotar_bitacora(p_ciudad_id, 'guardar_portal', 'portal', null,
                                 jsonb_build_object('hero_candidato', p_datos -> 'hero_candidato'));

  return jsonb_build_object('success', true);
end;
$$;
comment on function public.admin_portal_guardar is 'Guarda la cara pública del portal desde el panel. Campos ausentes no se tocan.';

select public.cerrar_funciones_admin();
