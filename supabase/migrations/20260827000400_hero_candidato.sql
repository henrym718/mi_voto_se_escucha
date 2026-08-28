-- ============================================================================
-- El interruptor de la portada del candidato.
--
-- EL PROBLEMA QUE RESUELVE
--
-- El panel lleva desde el principio campos para la cara del candidato —recorte
-- del hero, banner, logo, eslogan, medio del hero— y la portada pública nunca
-- los ha pintado. Está decidido así a propósito y está escrito en el código:
-- la propaganda de cartelera en el primer pliegue dispara el filtro
-- anti-política y la persona se va antes de ver una sola obra.
--
-- Pero el equipo llena esos campos, no ve nada, y con razón se pregunta si algo
-- está roto. Un campo que se guarda y no se usa es peor que no tenerlo: hace
-- dudar de todo lo demás.
--
-- LA DECISIÓN
--
-- La sección existe y se puede encender, pero NACE APAGADA. `default false` no
-- es un detalle: si naciera encendida, cada ciudad nueva estrenaría la portada
-- con la foto grande del candidato, que es exactamente lo que se quería evitar.
-- Encenderla es un acto deliberado del equipo, con el costo escrito al lado del
-- interruptor en el panel.
-- ============================================================================

alter table public.portal
  add column if not exists hero_candidato boolean not null default false;

comment on column public.portal.hero_candidato is
  'false = la portada abre con «¿Qué necesita tu sector?». true = abre con la cara del candidato. Nace en false a propósito.';

-- ------------------------------------------------------------ ciudad_portada --
-- Se reescribe entera porque arma el jsonb campo a campo: sin esto la columna
-- existiría y la portada nunca se enteraría de su valor.
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
  v_medio text := coalesce(nullif(p_datos ->> 'hero_medio', ''), 'foto');
begin
  if not public.puede_editar(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  if v_medio not in ('foto', 'video') then
    return jsonb_build_object('success', false, 'error_code', 'hero_medio_invalido');
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
    -- Solo cambia si viene en el jsonb: un guardado parcial de otra pestaña no
    -- puede encender ni apagar la portada por omisión.
    hero_candidato    = case when p_datos ? 'hero_candidato'
                             then coalesce((p_datos ->> 'hero_candidato')::boolean, false)
                             else hero_candidato end,
    bio               = coalesce(p_datos ->> 'bio', bio),
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

  perform public.anotar_bitacora(p_ciudad_id, 'guardar_portal', 'portal', null,
                                 jsonb_build_object('hero_candidato', p_datos -> 'hero_candidato'));

  return jsonb_build_object('success', true);
end;
$$;
comment on function public.admin_portal_guardar is 'Guarda la cara pública del portal desde el panel. Campos ausentes no se tocan.';

select public.cerrar_funciones_admin();
