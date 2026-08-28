-- ============================================================================
-- Video de presentación en la ficha de cada persona del equipo.
--
-- Un candidato hablando treinta segundos convence más que tres párrafos, y en
-- un cantón donde media campaña se hace por WhatsApp el video ya existe: está
-- subido en YouTube. Aquí solo se guarda el enlace.
--
-- Se guarda la URL tal cual la pega el equipo, no un identificador extraído:
-- si mañana cambia el formato de los enlaces de YouTube, se arregla en el
-- componente que lo incrusta y no hace falta migrar ninguna fila.
--
-- Solo YouTube, y validado en la base y no solo en el formulario: es una url
-- de terceros que se acaba metiendo en un iframe, y la lista blanca es lo que
-- impide que ahí entre cualquier cosa.
-- ============================================================================

alter table public.perfiles add column if not exists video_url text;

comment on column public.perfiles.video_url is 'Enlace de YouTube al video de presentación. Se incrusta en un diálogo desde la ficha pública.';

-- ------------------------------------------------------------- es_youtube --
create or replace function public.es_enlace_youtube(p_url text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    p_url ~* '^https?://(www\.|m\.)?(youtube\.com/(watch\?|embed/|shorts/|live/)|youtu\.be/)',
    false
  );
$$;

comment on function public.es_enlace_youtube is 'Lista blanca de enlaces incrustables. Todo lo demás se rechaza.';

-- -------------------------------------------------------- portal_perfil --
-- Se reescribe entera porque construye el jsonb campo a campo: sin tocarla, la
-- columna nueva existiría en la base y jamás llegaría a la ficha pública.
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
      'redes', v_perfil.redes, 'es_candidato', v_perfil.es_candidato,
      'video_url', v_perfil.video_url
    )
  );
end;
$$;
comment on function public.portal_perfil is 'Ficha completa de una persona del equipo, por slug.';

-- ----------------------------------------------------- admin_perfiles_guardar --
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
  v_item  jsonb;
  v_ids   uuid[] := '{}';
  v_id    uuid;
  v_slug  text;
  v_video text;
  v_orden integer := 0;
begin
  if not public.puede_editar(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  for v_item in select * from jsonb_array_elements(p_perfiles) loop
    if length(trim(coalesce(v_item ->> 'nombre', ''))) < 2 then
      return jsonb_build_object('success', false, 'error_code', 'nombre_muy_corto');
    end if;

    -- Se rechaza el lote entero antes de escribir nada: guardar la mitad
    -- dejaría la lista en un estado que el equipo no pidió.
    v_video := nullif(trim(coalesce(v_item ->> 'video_url', '')), '');
    if v_video is not null and not public.es_enlace_youtube(v_video) then
      return jsonb_build_object('success', false, 'error_code', 'video_no_es_youtube',
                                'detalle', v_item ->> 'nombre');
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
        video_url    = v_video,
        es_candidato = coalesce((v_item ->> 'es_candidato')::boolean, false),
        orden        = v_orden,
        activo       = true
      where id = v_id and ciudad_id = p_ciudad_id;
    else
      insert into public.perfiles (
        ciudad_id, slug, nombre, cargo, cedula, foto_url, bio,
        telefono, correo, redes, video_url, es_candidato, orden
      ) values (
        p_ciudad_id, v_slug, trim(v_item ->> 'nombre'),
        coalesce(v_item ->> 'cargo', ''), nullif(v_item ->> 'cedula', ''),
        nullif(v_item ->> 'foto_url', ''), coalesce(v_item ->> 'bio', ''),
        nullif(v_item ->> 'telefono', ''), nullif(v_item ->> 'correo', ''),
        coalesce(v_item -> 'redes', '{}'::jsonb), v_video,
        coalesce((v_item ->> 'es_candidato')::boolean, false), v_orden
      )
      -- Alguien que se quitó del equipo y vuelve: se revive su ficha en vez de
      -- reventar por slug repetido, igual que con los estados.
      on conflict (ciudad_id, slug) do update
        set nombre = excluded.nombre, cargo = excluded.cargo, cedula = excluded.cedula,
            foto_url = excluded.foto_url, bio = excluded.bio, telefono = excluded.telefono,
            correo = excluded.correo, redes = excluded.redes, video_url = excluded.video_url,
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

-- `admin_perfiles_listar` devuelve la fila entera con to_jsonb, así que hereda
-- la columna nueva sin tocarla.

grant execute on function public.es_enlace_youtube(text) to anon, authenticated;

-- Reemplazar una función conserva su ACL, pero la lista blanca de admin_* se
-- vuelve a aplicar por si acaso: es barata y evita depender de ese detalle.
select public.cerrar_funciones_admin();
