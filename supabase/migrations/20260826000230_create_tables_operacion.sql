-- ============================================================================
-- Operación: la bitácora del equipo.
--
-- Aquí vivía la cola de WhatsApp. Se fue entera, y con ella el worker y el
-- cron: mandar un mensaje por cada cambio de estado a miles de vecinos cuesta
-- entre 2 y 5 centavos por envío, y el 90% de esos avisos son trámite interno
-- que al vecino no le mueve nada. El avance se consulta en la web, que es
-- gratis, y lo colectivo se comunica por el canal de WhatsApp del sector, que
-- también es gratis y va de uno a muchos.
-- ============================================================================

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

comment on table public.bitacora is 'Quién hizo qué. Protege al equipo cuando preguntan quién publicó eso.';

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
