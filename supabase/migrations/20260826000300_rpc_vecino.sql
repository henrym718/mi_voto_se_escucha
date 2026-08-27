-- ============================================================================
-- RPC del vecino.
--
-- Quien llama es una sesión anónima de Supabase Auth: el navegador la crea sola
-- en la primera visita, sin pedir nada, y a partir de ahí `auth.uid()` existe y
-- es estable mientras no borre los datos del sitio.
--
-- La ficha del vecino NO se crea al entrar. Nace en el primer acto real —un
-- apoyo o un pedido— para que el padrón cuente participantes y no visitas.
-- Por eso `vecino_asegurar` es internal: la llaman `obra_apoyar` y `obra_crear`
-- desde dentro, y también `vecino_guardar_contacto` cuando el vecino deja su
-- número antes de que se registre el apoyo.
-- ============================================================================

-- Crea la ficha si no existe. Idempotente y sin efectos si ya está.
create or replace function public.vecino_asegurar_interno(
  p_ciudad_id uuid,
  p_origen    text default 'directo'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.vecinos (id, ciudad_id, origen)
  values (auth.uid(), p_ciudad_id,
          case when p_origen in ('directo', 'qr', 'compartido') then p_origen else 'directo' end)
  on conflict (id) do update set ultimo_acceso_en = now();
end;
$$;

revoke all on function public.vecino_asegurar_interno(uuid, text) from public, anon, authenticated;

comment on function public.vecino_asegurar_interno is 'Alta perezosa del vecino. Solo la llaman otras RPC, nunca el navegador.';

-- --------------------------------------------------- vecino_guardar_contacto --
-- Lo que graba el modal de un solo campo, la primera vez que el vecino apoya o
-- publica. El sector viene del filtro que ya tenía puesto, así que casi siempre
-- llega resuelto y no hay que preguntarlo.
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
  if auth.uid() is null then
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

comment on function public.vecino_guardar_contacto is 'Graba el WhatsApp del vecino. Se pide una sola vez y queda en su navegador.';

-- ------------------------------------------------------------- vecino_yo --
-- Lo que la aplicación necesita saber al arrancar: si ya dejó su número y en
-- qué sector se ubicó. Con esto decide si el modal aparece o no.
create or replace function public.vecino_yo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_vecino public.vecinos;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', true, 'vecino', null);
  end if;

  select * into v_vecino from public.vecinos where id = auth.uid();
  if v_vecino.id is null then
    return jsonb_build_object('success', true, 'vecino', null);
  end if;

  return jsonb_build_object(
    'success', true,
    'vecino', jsonb_build_object(
      'ciudadela_id', v_vecino.ciudadela_id,
      'tiene_telefono', v_vecino.telefono is not null,
      'quiere_canal', v_vecino.quiere_canal
    )
  );
end;
$$;

-- ------------------------------------------------- vecino_elegir_ciudadela --
-- Cambiar de sector. No afecta a qué puede apoyar: solo a cómo se segmenta su
-- contacto para el canal del barrio.
create or replace function public.vecino_elegir_ciudadela(p_ciudadela_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ciudad_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  select v.ciudad_id into v_ciudad_id from public.vecinos v where v.id = auth.uid();
  if v_ciudad_id is null then
    return jsonb_build_object('success', false, 'error_code', 'vecino_no_registrado');
  end if;

  if not exists (
    select 1 from public.ciudadelas cd
     where cd.id = p_ciudadela_id and cd.ciudad_id = v_ciudad_id and cd.activa
  ) then
    return jsonb_build_object('success', false, 'error_code', 'ciudadela_invalida');
  end if;

  update public.vecinos
     set ciudadela_id = p_ciudadela_id, ultimo_acceso_en = now()
   where id = auth.uid();

  return jsonb_build_object('success', true, 'ciudadela_id', p_ciudadela_id);
end;
$$;
