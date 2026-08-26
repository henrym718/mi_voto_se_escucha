-- ============================================================================
-- Identidad: el equipo de campaña (admins) y los vecinos verificados.
--
-- El código OTP NO se genera ni se guarda aquí: lo produce y lo valida Supabase
-- Auth (gotrue) con el flujo nativo de teléfono. Un "Send SMS Hook" intercepta
-- el código y lo entrega por WhatsApp vía Kapso en vez de por SMS. Es el mismo
-- patrón que ya funciona en Pronto.
-- Lo único propio es la bitácora de límite por teléfono, porque Supabase limita
-- por IP y sin esto se puede bombardear UN número desde muchas IPs.
--
-- El padrón de vecinos es el activo del negocio. Ninguna política de este
-- archivo deja que el cliente lea teléfonos: el equipo ve agregados por RPC.
-- ============================================================================

-- ------------------------------------------------------------------ admins --
create table public.admins (
  id         uuid primary key references auth.users (id) on delete cascade,
  ciudad_id  uuid not null references public.ciudades (id) on delete cascade,
  rol        text not null check (rol in ('admin', 'editor', 'candidato')),
  nombre     text not null default '',
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

comment on table public.admins is 'Equipo de campaña. admin: todo. editor: contenido y estados. candidato: solo lectura.';

alter table public.admins enable row level security;

create policy "el equipo se ve a sí mismo"
  on public.admins for select
  using (id = auth.uid() or public.es_del_equipo(ciudad_id));

create policy "solo el admin gestiona al equipo"
  on public.admins for all
  using (public.es_admin(ciudad_id))
  with check (public.es_admin(ciudad_id));

-- ----------------------------------------------------------------- vecinos --
create table public.vecinos (
  id                    uuid primary key references auth.users (id) on delete cascade,
  ciudad_id             uuid not null references public.ciudades (id) on delete cascade,
  ciudadela_id          uuid references public.ciudadelas (id) on delete set null,
  telefono              text not null,
  nombre                text,
  edad_rango            text check (edad_rango in ('18-25', '26-35', '36-50', '51-65', '65+')),
  genero                text check (genero in ('f', 'm', 'otro', 'prefiero-no-decir')),
  consentimiento_notif  boolean not null default true,
  baja_en               timestamptz,
  origen                text not null default 'directo' check (origen in ('directo', 'qr', 'compartido')),
  creado_en             timestamptz not null default now(),
  ultimo_acceso_en      timestamptz not null default now(),
  unique (ciudad_id, telefono)
);

comment on table public.vecinos is 'Padrón verificado por OTP. Un teléfono por ciudad.';
comment on column public.vecinos.origen is 'De dónde vino el registro. qr = volante o tarima; compartido = enlace de WhatsApp.';
comment on column public.vecinos.baja_en is 'Con fecha, respondió BAJA y no recibe más mensajes.';
comment on column public.vecinos.edad_rango is 'Perfilado progresivo: se pide DESPUÉS del primer apoyo y es opcional.';

alter table public.vecinos enable row level security;

-- Un vecino solo ve y edita su propia ficha. El equipo nunca lee esta tabla:
-- consulta agregados por RPC.
create policy "el vecino ve su propia ficha"
  on public.vecinos for select
  using (id = auth.uid());

create policy "el vecino edita su propia ficha"
  on public.vecinos for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------- otp_send_log --
-- Bitácora de conteo, no de secretos: guarda el teléfono en claro porque solo
-- sirve para contar envíos en una ventana de tiempo.
create table public.otp_send_log (
  id        bigint generated always as identity primary key,
  telefono  text not null,
  enviado_en timestamptz not null default now()
);

comment on table public.otp_send_log is 'Cuántos códigos se pidieron por teléfono. Base del límite propio.';

alter table public.otp_send_log enable row level security;
-- Sin políticas a propósito: deny-all. Solo la Edge Function con service_role
-- llega aquí, y únicamente a través de la función de abajo.

create index otp_send_log_telefono_fecha on public.otp_send_log (telefono, enviado_en desc);

-- ¿Puede pedir otro código? Máximo 5 por hora y 10 por día por teléfono.
-- El lock serializa dos solicitudes simultáneas del mismo número: sin él las
-- dos podrían pasar el conteo a la vez.
create or replace function public.otp_limite_ok(p_telefono text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hora integer;
  v_dia  integer;
begin
  if p_telefono is null or length(trim(p_telefono)) < 8 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('otp:' || p_telefono));

  select count(*) into v_hora
    from public.otp_send_log
   where telefono = p_telefono and enviado_en > now() - interval '1 hour';

  select count(*) into v_dia
    from public.otp_send_log
   where telefono = p_telefono and enviado_en > now() - interval '24 hours';

  if v_hora >= 5 or v_dia >= 10 then
    return false;
  end if;

  insert into public.otp_send_log (telefono) values (p_telefono);

  -- Limpieza oportunista: pasados dos días ya no cuentan para nada.
  delete from public.otp_send_log where enviado_en < now() - interval '2 days';

  return true;
end;
$$;

revoke all on function public.otp_limite_ok(text) from public, anon, authenticated, service_role;
grant execute on function public.otp_limite_ok(text) to service_role;

comment on function public.otp_limite_ok is 'Límite propio por teléfono (5/hora, 10/día). Supabase solo limita por IP.';
