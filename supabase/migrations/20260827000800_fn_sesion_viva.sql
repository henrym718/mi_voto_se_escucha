-- ============================================================================
-- Una sesión muerta ya no revienta: responde 'sin_sesion'.
--
-- El síntoma: el navegador manda un JWT válido, la RPC devuelve 409 y el vecino
-- ve "No pudimos registrar tu apoyo. Intenta otra vez." — que es mentira,
-- porque reintentar no lo arregla nunca.
--
-- La causa: `auth.uid()` sale del token, no de la base. Si ese usuario ya no
-- existe —la base se reseteó, o se limpiaron las sesiones anónimas— el uid es
-- un uuid perfectamente válido que no está en `auth.users`. El `if v_uid is
-- null` no lo atrapa, y el insert en `vecinos` (cuya PK es una clave foránea
-- contra `auth.users`) revienta con 23503, que PostgREST traduce a 409.
--
-- La corrección: `sesion_viva()` — hay uid Y ese usuario existe. Las tres RPC
-- que dan de alta al vecino la usan en lugar del chequeo de nulo, así que un
-- token caducado ahora devuelve un error de negocio con su mensaje ("Recarga la
-- página e intenta otra vez") en vez de un error crudo de Postgres.
-- ============================================================================

-- ------------------------------------------------------------ sesion_viva --
-- No basta con que haya uid: tiene que haber usuario detrás. Es la diferencia
-- entre "no hay sesión" y "hay una sesión que ya no existe", que desde el
-- navegador se ven igual y en la base no lo son.
create or replace function public.sesion_viva()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from auth.users u where u.id = auth.uid());
$$;

revoke all on function public.sesion_viva() from public, anon, authenticated;

comment on function public.sesion_viva is 'Hay sesión Y el usuario del token sigue existiendo. Solo la llaman otras RPC.';

-- ----------------------------------------------------------- obra_apoyar --
create or replace function public.obra_apoyar(p_obra_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_obra public.obras;
begin
  if not public.sesion_viva() then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  select * into v_obra from public.obras where id = p_obra_id;
  if v_obra.id is null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_encontrada');
  end if;
  if not v_obra.aprobada or v_obra.fusionada_en is not null or v_obra.rechazada_en is not null then
    return jsonb_build_object('success', false, 'error_code', 'obra_no_disponible');
  end if;

  perform public.vecino_asegurar_interno(v_obra.ciudad_id);

  insert into public.votos (obra_id, vecino_id, ciudad_id)
  values (p_obra_id, v_uid, v_obra.ciudad_id)
  on conflict (obra_id, vecino_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'apoyos', (select apoyos from public.obras where id = p_obra_id)
  );
end;
$$;

-- ------------------------------------------------------------ obra_crear --
create or replace function public.obra_crear(
  p_ciudadela_id  uuid,
  p_categoria_id  uuid,
  p_texto         text default null,
  p_audio_url     text default null,
  p_foto_url      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_ciudad_id uuid;
  v_estado    uuid;
  v_recientes integer;
  v_obra      public.obras;
begin
  if not public.sesion_viva() then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  -- Sin nada que contar no hay pedido: ni texto ni nota de voz.
  if coalesce(trim(p_texto), '') = '' and coalesce(trim(p_audio_url), '') = '' then
    return jsonb_build_object('success', false, 'error_code', 'sin_contenido');
  end if;

  select cd.ciudad_id into v_ciudad_id
    from public.ciudadelas cd
   where cd.id = p_ciudadela_id and cd.activa;
  if v_ciudad_id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudadela_invalida');
  end if;

  if not exists (
    select 1 from public.categorias ct
     where ct.id = p_categoria_id and ct.ciudad_id = v_ciudad_id and ct.activa
  ) then
    return jsonb_build_object('success', false, 'error_code', 'categoria_invalida');
  end if;

  perform public.vecino_asegurar_interno(v_ciudad_id);

  -- Anti-inundación: máximo 3 pedidos por persona por día.
  select count(*)::integer into v_recientes
    from public.obras o
   where o.creador_id = v_uid and o.creada_en > now() - interval '24 hours';
  if v_recientes >= 3 then
    return jsonb_build_object('success', false, 'error_code', 'demasiados_pedidos_hoy');
  end if;

  select e.id into v_estado
    from public.estados e
   where e.ciudad_id = v_ciudad_id and e.es_inicial and e.activo;
  if v_estado is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_estado_inicial');
  end if;

  insert into public.obras (
    ciudad_id, ciudadela_id, categoria_id, estado_id,
    texto_original, audio_url, foto_url, ia_estado, origen, creador_id, aprobada
  ) values (
    v_ciudad_id, p_ciudadela_id, p_categoria_id, v_estado,
    nullif(trim(coalesce(p_texto, '')), ''), nullif(trim(coalesce(p_audio_url, '')), ''),
    p_foto_url, 'pendiente', 'vecino', v_uid, false
  )
  returning * into v_obra;

  -- Quien pide una obra la apoya de entrada.
  insert into public.votos (obra_id, vecino_id, ciudad_id)
  values (v_obra.id, v_uid, v_obra.ciudad_id)
  on conflict do nothing;

  return jsonb_build_object(
    'success', true,
    'obra', jsonb_build_object('id', v_obra.id, 'codigo', v_obra.codigo),
    'enlace_canal', (select cd.enlace_canal from public.ciudadelas cd where cd.id = p_ciudadela_id)
  );
end;
$$;

-- ---------------------------------------------- vecino_guardar_contacto --
create or replace function public.vecino_guardar_contacto(
  p_ciudad_slug  text,
  p_telefono     text,
  p_ciudadela_id uuid default null,
  p_quiere_canal boolean default false,
  p_origen       text default 'directo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ciudad_id uuid;
  v_telefono  text;
  v_enlace    text;
begin
  if not public.sesion_viva() then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  select c.id into v_ciudad_id from public.ciudades c where c.slug = p_ciudad_slug and c.activa;
  if v_ciudad_id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudad_no_encontrada');
  end if;

  -- Se guarda normalizado a E.164 o no se guarda. Un padrón con "0999-123456",
  -- "999123456" y "+593 99 912 3456" para la misma persona no sirve para nada.
  v_telefono := public.normalizar_telefono(p_telefono);
  if v_telefono is null then
    return jsonb_build_object('success', false, 'error_code', 'telefono_invalido');
  end if;

  if p_ciudadela_id is not null and not exists (
    select 1 from public.ciudadelas cd
     where cd.id = p_ciudadela_id and cd.ciudad_id = v_ciudad_id and cd.activa
  ) then
    return jsonb_build_object('success', false, 'error_code', 'ciudadela_invalida');
  end if;

  perform public.vecino_asegurar_interno(v_ciudad_id, p_origen);

  update public.vecinos
     set telefono         = v_telefono,
         ciudadela_id     = coalesce(p_ciudadela_id, ciudadela_id),
         quiere_canal     = p_quiere_canal or quiere_canal,
         ultimo_acceso_en = now()
   where id = auth.uid();

  -- Si pidió el canal y su sector ya tiene enlace, se le devuelve para que la
  -- pantalla de confirmación lo lleve directo. Sin enlace no se promete nada.
  if p_quiere_canal then
    select cd.enlace_canal into v_enlace
      from public.vecinos v
      join public.ciudadelas cd on cd.id = v.ciudadela_id
     where v.id = auth.uid();
  end if;

  return jsonb_build_object('success', true, 'enlace_canal', v_enlace);
end;
$$;
