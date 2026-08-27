-- ============================================================================
-- Núcleo territorial y de configuración. Multi-ciudad desde el día uno:
-- toda tabla del sistema cuelga de `ciudades`.
-- Cada tabla se crea con su RLS habilitada y sus políticas en esta misma
-- migración. Sin excepciones.
-- ============================================================================

-- ---------------------------------------------------------------- ciudades --
create table public.ciudades (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  nombre            text not null,
  provincia         text not null,
  poblacion_urbana  integer,
  modo              text not null default 'campana' check (modo in ('campana', 'gestion')),
  activa            boolean not null default true,
  creada_en         timestamptz not null default now()
);

comment on table public.ciudades is 'Un tenant por ciudad. El dominio resuelve el slug.';
comment on column public.ciudades.poblacion_urbana is 'Censo INEC. Base del porcentaje de vecinos por ciudadela.';
comment on column public.ciudades.modo is 'campana: el candidato escucha y promete. gestion: ya ganó y ejecuta.';

alter table public.ciudades enable row level security;

create policy "ciudades activas visibles para cualquiera"
  on public.ciudades for select
  using (activa);

create policy "solo el admin edita su ciudad"
  on public.ciudades for update
  using (public.es_admin(id))
  with check (public.es_admin(id));

-- ------------------------------------------------------------------ portal --
-- Branding y contenido de la portada. 1:1 con la ciudad.
create table public.portal (
  ciudad_id          uuid primary key references public.ciudades (id) on delete cascade,
  candidato_nombre   text not null default '',
  candidato_cargo    text not null default '',
  partido            text not null default '',
  eslogan            text not null default '',
  bio                text not null default '',
  foto_url           text,
  banner_url         text,
  video_url          text,
  video_portada_url  text,
  logo_url           text,
  color_marca        text not null default '#0d7d6c',
  whatsapp_contacto  text,
  redes              jsonb not null default '{}'::jsonb,
  actualizado_en     timestamptz not null default now()
);

comment on table public.portal is 'Cara pública del cliente. El color_marca se inyecta como variable CSS.';

alter table public.portal enable row level security;

create policy "portal visible para cualquiera"
  on public.portal for select
  using (true);

create policy "el equipo edita el portal de su ciudad"
  on public.portal for update
  using (public.puede_editar(ciudad_id))
  with check (public.puede_editar(ciudad_id));

-- -------------------------------------------------------------- ciudadelas --
create table public.ciudadelas (
  id                  uuid primary key default gen_random_uuid(),
  ciudad_id           uuid not null references public.ciudades (id) on delete cascade,
  nombre              text not null,
  slug                text not null,
  zona                text not null default 'urbana' check (zona in ('urbana', 'rural', 'funcional')),
  verificado          boolean not null default false,
  fuente              text,
  poblacion_estimada  integer,
  enlace_canal        text,
  activa              boolean not null default true,
  orden               integer not null default 0,
  creada_en           timestamptz not null default now(),
  unique (ciudad_id, slug)
);

comment on table public.ciudadelas is 'Lista cerrada. El vecino elige de aquí; nunca escribe texto libre.';
comment on column public.ciudadelas.enlace_canal is 'Invitación al canal de WhatsApp del sector. Con ella, el vecino se une de un toque y el equipo no paga un centavo por avisar.';
comment on column public.ciudadelas.verificado is 'true = confirmado por documento municipal. false = por verificar (OSM).';
comment on column public.ciudadelas.zona is 'funcional = sector de uso corriente sin respaldo documental, ej. "Centro".';

alter table public.ciudadelas enable row level security;

create policy "ciudadelas activas visibles para cualquiera"
  on public.ciudadelas for select
  using (activa);

create policy "el equipo gestiona sus ciudadelas"
  on public.ciudadelas for all
  using (public.puede_editar(ciudad_id))
  with check (public.puede_editar(ciudad_id));

-- -------------------------------------------------------------- categorias --
create table public.categorias (
  id         uuid primary key default gen_random_uuid(),
  ciudad_id  uuid not null references public.ciudades (id) on delete cascade,
  nombre     text not null,
  slug       text not null,
  icono      text not null default 'wrench',
  color      text not null default '#0d7d6c',
  orden      integer not null default 0,
  activa     boolean not null default true,
  unique (ciudad_id, slug)
);

comment on table public.categorias is 'Tipos de obra. Se ordenan por déficit real del cantón, no alfabéticamente.';

alter table public.categorias enable row level security;

create policy "categorias activas visibles para cualquiera"
  on public.categorias for select
  using (activa);

create policy "el equipo gestiona sus categorias"
  on public.categorias for all
  using (public.puede_editar(ciudad_id))
  with check (public.puede_editar(ciudad_id));

-- ----------------------------------------------------------------- estados --
-- Configurables por ciudad. Las columnas del kanban del panel son estas filas.
create table public.estados (
  id               uuid primary key default gen_random_uuid(),
  ciudad_id        uuid not null references public.ciudades (id) on delete cascade,
  nombre           text not null,
  slug             text not null,
  descripcion      text not null default '',
  color            text not null default '#8b8993',
  orden            integer not null default 0,
  es_inicial       boolean not null default false,
  es_compromiso    boolean not null default false,
  es_cierre_suave  boolean not null default false,
  activo           boolean not null default true,
  unique (ciudad_id, slug)
);

comment on table public.estados is 'Estados configurables por ciudad. Plantilla de campaña o de gestión.';
comment on column public.estados.es_inicial is 'Estado que recibe toda obra nueva. Exactamente uno por ciudad.';
comment on column public.estados.es_compromiso is 'Marca la obra como prometida públicamente por el candidato.';
comment on column public.estados.es_cierre_suave is 'Aterrizaje sin costo político: "En estudio técnico", "A mediano plazo". Nunca "No viable".';

alter table public.estados enable row level security;

create policy "estados activos visibles para cualquiera"
  on public.estados for select
  using (activo);

create policy "el equipo gestiona sus estados"
  on public.estados for all
  using (public.puede_editar(ciudad_id))
  with check (public.puede_editar(ciudad_id));

-- Exactamente un estado inicial por ciudad.
create unique index estados_uno_inicial_por_ciudad
  on public.estados (ciudad_id)
  where es_inicial;
