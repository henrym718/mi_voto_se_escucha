-- ============================================================================
-- RPC del vecino. Se llaman justo después de que Supabase Auth validó el OTP:
-- en ese momento ya hay sesión y auth.uid() apunta al usuario recién creado.
-- ============================================================================

-- Crea o actualiza la ficha del vecino tras verificar el teléfono.
-- Idempotente: llamarla dos veces no duplica nada.
create or replace function public.vecino_asegurar(
  p_ciudad_slug   text,
  p_ciudadela_id  uuid default null,
  p_origen        text default 'directo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_telefono  text;
  v_ciudad_id uuid;
  v_vecino    public.vecinos;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  -- El teléfono sale del JWT, no del cliente: es el que gotrue verificó.
  select u.phone into v_telefono from auth.users u where u.id = v_uid;
  if v_telefono is null or v_telefono = '' then
    return jsonb_build_object('success', false, 'error_code', 'sin_telefono_verificado');
  end if;
  if left(v_telefono, 1) <> '+' then
    v_telefono := '+' || v_telefono;
  end if;

  select c.id into v_ciudad_id from public.ciudades c where c.slug = p_ciudad_slug and c.activa;
  if v_ciudad_id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudad_no_encontrada');
  end if;

  -- La ciudadela, si viene, tiene que ser de esta ciudad.
  if p_ciudadela_id is not null then
    if not exists (
      select 1 from public.ciudadelas cd
       where cd.id = p_ciudadela_id and cd.ciudad_id = v_ciudad_id and cd.activa
    ) then
      return jsonb_build_object('success', false, 'error_code', 'ciudadela_invalida');
    end if;
  end if;

  insert into public.vecinos (id, ciudad_id, ciudadela_id, telefono, origen)
  values (v_uid, v_ciudad_id, p_ciudadela_id, v_telefono,
          case when p_origen in ('directo', 'qr', 'compartido') then p_origen else 'directo' end)
  on conflict (id) do update
    set ciudadela_id     = coalesce(excluded.ciudadela_id, public.vecinos.ciudadela_id),
        ultimo_acceso_en = now()
  returning * into v_vecino;

  return jsonb_build_object(
    'success', true,
    'vecino', jsonb_build_object(
      'id', v_vecino.id,
      'ciudad_id', v_vecino.ciudad_id,
      'ciudadela_id', v_vecino.ciudadela_id,
      'nombre', v_vecino.nombre,
      'necesita_ciudadela', v_vecino.ciudadela_id is null,
      'necesita_perfil', v_vecino.edad_rango is null
    )
  );
end;
$$;

comment on function public.vecino_asegurar is 'Alta idempotente del vecino tras el OTP. El teléfono se lee del JWT, nunca del cliente.';

-- Elegir o cambiar la ciudadela. Es donde el vecino puede apoyar.
create or replace function public.vecino_elegir_ciudadela(p_ciudadela_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_ciudad_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  select v.ciudad_id into v_ciudad_id from public.vecinos v where v.id = v_uid;
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
   where id = v_uid;

  return jsonb_build_object('success', true, 'ciudadela_id', p_ciudadela_id);
end;
$$;

-- Perfilado progresivo: se pide DESPUÉS del primer apoyo y todo es opcional.
create or replace function public.vecino_perfilar(
  p_nombre     text default null,
  p_edad_rango text default null,
  p_genero     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  update public.vecinos
     set nombre     = coalesce(nullif(trim(p_nombre), ''), nombre),
         edad_rango = coalesce(p_edad_rango, edad_rango),
         genero     = coalesce(p_genero, genero),
         ultimo_acceso_en = now()
   where id = v_uid;

  return jsonb_build_object('success', true);
end;
$$;

-- Baja de notificaciones en un toque.
create or replace function public.vecino_darse_de_baja()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error_code', 'sin_sesion');
  end if;

  update public.vecinos
     set consentimiento_notif = false, baja_en = now()
   where id = v_uid;

  return jsonb_build_object('success', true);
end;
$$;
