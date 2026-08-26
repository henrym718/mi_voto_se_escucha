-- ============================================================================
-- Operación: la cola de notificaciones de WhatsApp y la bitácora del equipo.
--
-- Nada que tarde hace esperar al vecino. Un cambio de estado que avisa a 400
-- personas encola 400 filas y responde al instante; un worker las procesa por
-- lotes con reintentos. El OTP es la única excepción: va directo, sin cola.
-- ============================================================================

-- ---------------------------------------------------------- notificaciones --
create table public.notificaciones (
  id              uuid primary key default gen_random_uuid(),
  ciudad_id       uuid not null references public.ciudades (id) on delete cascade,
  vecino_id       uuid references public.vecinos (id) on delete cascade,
  telefono        text not null,
  plantilla       text not null,
  params          jsonb not null default '{}'::jsonb,
  boton_path      text,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente', 'enviando', 'enviado', 'fallido', 'descartado')),
  intentos        integer not null default 0,
  ultimo_error    text,
  programada_para timestamptz not null default now(),
  enviada_en      timestamptz,
  origen_tipo     text,
  origen_id       uuid,
  creada_en       timestamptz not null default now()
);

comment on table public.notificaciones is 'Cola de WhatsApp. Un worker la drena por lotes con reintentos 2/10/30 min.';
comment on column public.notificaciones.plantilla is 'Sufijo de la plantilla de Kapso; el worker le antepone el prefijo del ambiente.';
comment on column public.notificaciones.boton_path is 'Ruta que se inyecta en el botón URL de la plantilla, ej. o/K3M9PX';
comment on column public.notificaciones.origen_tipo is 'obra | difusion | sistema — para medir alcance por campaña.';
comment on column public.notificaciones.estado is 'descartado = el vecino se dio de baja o superó el tope semanal.';

alter table public.notificaciones enable row level security;
-- Deny-all: la escribe la RPC de cambio de estado y la drena el worker con
-- service_role. El equipo ve el alcance por RPC agregada, no la tabla.

create index notificaciones_pendientes
  on public.notificaciones (programada_para)
  where estado = 'pendiente';

create index notificaciones_por_origen
  on public.notificaciones (ciudad_id, origen_tipo, origen_id);

-- Freno de mano: cuántos mensajes NO transaccionales recibió un vecino en la
-- última semana. La difusión lo consulta antes de encolar.
create or replace function public.mensajes_ultima_semana(p_vecino_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.notificaciones n
   where n.vecino_id = p_vecino_id
     and n.origen_tipo = 'difusion'
     and n.creada_en > now() - interval '7 days'
     and n.estado in ('pendiente', 'enviando', 'enviado');
$$;

-- ---------------------------------------------------------------- bitacora --
create table public.bitacora (
  id          uuid primary key default gen_random_uuid(),
  ciudad_id   uuid not null references public.ciudades (id) on delete cascade,
  admin_id    uuid references public.admins (id) on delete set null,
  accion      text not null,
  entidad     text not null,
  entidad_id  uuid,
  detalle     jsonb not null default '{}'::jsonb,
  creada_en   timestamptz not null default now()
);

comment on table public.bitacora is 'Quién hizo qué. Protege al equipo cuando preguntan quién mandó ese mensaje.';

alter table public.bitacora enable row level security;

create policy "el equipo lee la bitácora de su ciudad"
  on public.bitacora for select
  using (public.es_del_equipo(ciudad_id));

-- Sin insert directo: la escriben las RPC del panel.

create index bitacora_por_ciudad on public.bitacora (ciudad_id, creada_en desc);

-- Registrar una acción del equipo. La llaman las RPC en security definer.
create or replace function public.anotar_bitacora(
  p_ciudad_id  uuid,
  p_accion     text,
  p_entidad    text,
  p_entidad_id uuid,
  p_detalle    jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.bitacora (ciudad_id, admin_id, accion, entidad, entidad_id, detalle)
  values (p_ciudad_id, auth.uid(), p_accion, p_entidad, p_entidad_id, p_detalle);
$$;
