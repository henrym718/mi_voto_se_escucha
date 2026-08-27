-- ============================================================================
-- Identidad: el equipo de campaña (admins) y los vecinos que participan.
--
-- No hay código de verificación en ninguna parte. El vecino entra, mira todo y
-- apoya; su identidad es una sesión anónima de Supabase Auth que el navegador
-- crea sola en la primera visita. Eso le da un `auth.uid()` real —y con él las
-- mismas RLS, el mismo "un apoyo por persona" y la misma carpeta propia en
-- storage— sin pedirle nada.
--
-- El teléfono ya no es una credencial: es un dato de contacto que se pide una
-- sola vez, en el primer apoyo, y que nadie verifica. Por eso NO es único: si
-- alguien escribe mal un número, o teclea el de un vecino, no puede dejar
-- fuera al dueño real.
--
-- El padrón sigue siendo el activo del negocio. Ninguna política de este
-- archivo deja que el cliente lea teléfonos: el equipo los ve por RPC.
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
  id                uuid primary key references auth.users (id) on delete cascade,
  ciudad_id         uuid not null references public.ciudades (id) on delete cascade,
  ciudadela_id      uuid references public.ciudadelas (id) on delete set null,
  telefono          text,
  quiere_canal      boolean not null default false,
  origen            text not null default 'directo' check (origen in ('directo', 'qr', 'compartido')),
  creado_en         timestamptz not null default now(),
  ultimo_acceso_en  timestamptz not null default now()
);

comment on table public.vecinos is 'Quien participó al menos una vez. La fila nace en el primer apoyo o pedido, no al entrar.';
comment on column public.vecinos.telefono is 'Contacto para el canal del sector. Sin verificar y NO único: nadie prueba que sea suyo.';
comment on column public.vecinos.ciudadela_id is 'Sector declarado por el vecino. Segmenta el padrón; ya no limita dónde puede apoyar.';
comment on column public.vecinos.quiere_canal is 'Pidió que lo sumen al canal de WhatsApp de su sector.';
comment on column public.vecinos.origen is 'De dónde vino. qr = volante o tarima; compartido = enlace de WhatsApp.';

alter table public.vecinos enable row level security;

-- Un vecino solo ve su propia ficha. El equipo nunca lee esta tabla desde el
-- cliente: consulta agregados y listas de contacto por RPC.
create policy "el vecino ve su propia ficha"
  on public.vecinos for select
  using (id = auth.uid());

-- Sin política de escritura: la ficha se crea y se actualiza por RPC, que es
-- donde vive la normalización del teléfono.
