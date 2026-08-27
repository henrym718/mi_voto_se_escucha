-- ============================================================================
-- El dominio: obras pedidas, apoyos y la línea de tiempo pública.
--
-- Regla que atraviesa todo el archivo: nadie escribe directamente. Los apoyos
-- y los pedidos entran por RPC en security definer, que es donde viven las
-- reglas de negocio (una obra por persona, votar solo en tu ciudadela). Las
-- políticas de escritura de estas tablas son deny-all a propósito.
-- ============================================================================

-- Código corto para enlaces compartibles en WhatsApp: /o/K3M9PX
create or replace function public.generar_codigo_obra()
returns text
language plpgsql
volatile
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin I, O, 0, 1
  v_codigo text;
  v_i integer;
begin
  loop
    v_codigo := '';
    for v_i in 1..6 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.obras where codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

-- ------------------------------------------------------------------- obras --
create table public.obras (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,
  ciudad_id       uuid not null references public.ciudades (id) on delete cascade,
  ciudadela_id    uuid not null references public.ciudadelas (id) on delete restrict,
  categoria_id    uuid not null references public.categorias (id) on delete restrict,
  estado_id       uuid not null references public.estados (id) on delete restrict,
  titulo          text check (titulo is null or length(trim(titulo)) between 8 and 120),
  descripcion     text not null default '' check (length(descripcion) <= 1000),
  foto_url        text,
  audio_url       text,
  texto_original  text,
  transcripcion   text,
  ia_estado       text not null default 'no_aplica'
                    check (ia_estado in ('no_aplica', 'pendiente', 'listo', 'fallido')),
  origen          text not null default 'vecino' check (origen in ('vecino', 'pdot', 'equipo')),
  fuente          text,
  aprobada        boolean not null default false,
  aprobada_en     timestamptz,
  aprobada_por    uuid references public.admins (id) on delete set null,
  rechazada_en    timestamptz,
  motivo_rechazo  text,
  fusionada_en    uuid references public.obras (id) on delete set null,
  creador_id      uuid references public.vecinos (id) on delete set null,
  apoyos          integer not null default 0,
  creada_en       timestamptz not null default now(),
  actualizada_en  timestamptz not null default now()
);

comment on table public.obras is 'Pedidos de obra. Una obra fusionada deja de mostrarse y sus apoyos pasan al destino.';
comment on column public.obras.origen is 'pdot: pre-cargada desde el plan municipal para resolver el arranque en frío. Siempre con fuente citada.';
comment on column public.obras.fuente is 'Cita textual del documento cuando origen = pdot. Se muestra al vecino.';
comment on column public.obras.apoyos is 'Contador denormalizado, mantenido por trigger. Nunca se escribe a mano.';
comment on column public.obras.fusionada_en is 'Si tiene valor, esta obra fue absorbida por otra y no se lista.';
comment on column public.obras.titulo is 'Nulo mientras la IA no ordena el pedido. Sin título no se aprueba ni se lista.';
comment on column public.obras.audio_url is 'Ruta dentro del bucket privado `notas`, no una URL pública. El panel pide el enlace firmado al abrirla.';
comment on column public.obras.texto_original is 'Lo que el vecino escribió, tal cual. Nunca se muestra en público.';
comment on column public.obras.transcripcion is 'Lo que Whisper oyó en la nota de voz.';
comment on column public.obras.ia_estado is 'pendiente: entró y falta procesar. fallido: el equipo la redacta a mano.';

alter table public.obras enable row level security;

-- Pública: solo lo aprobado y no fusionado. El creador ve además la suya en cola.
create policy "obras aprobadas visibles para cualquiera"
  on public.obras for select
  using (
    (aprobada and fusionada_en is null and rechazada_en is null)
    or creador_id = auth.uid()
    or public.es_del_equipo(ciudad_id)
  );

create policy "el equipo gestiona las obras de su ciudad"
  on public.obras for update
  using (public.puede_editar(ciudad_id))
  with check (public.puede_editar(ciudad_id));

-- Sin política de insert: los pedidos entran por la RPC obra_crear.

-- ------------------------------------------------------------------- votos --
create table public.votos (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references public.obras (id) on delete cascade,
  vecino_id  uuid not null references public.vecinos (id) on delete cascade,
  ciudad_id  uuid not null references public.ciudades (id) on delete cascade,
  creado_en  timestamptz not null default now(),
  unique (obra_id, vecino_id)
);

comment on table public.votos is 'Un apoyo por vecino por obra, garantizado por el índice único.';

alter table public.votos enable row level security;

-- El vecino ve sus propios apoyos para que la interfaz muestre "ya apoyaste".
-- Nadie ve los de otros: el conteo público sale de obras.apoyos.
create policy "el vecino ve sus propios apoyos"
  on public.votos for select
  using (vecino_id = auth.uid());

-- Sin políticas de escritura: todo pasa por las RPC obra_apoyar / obra_quitar_apoyo.

-- ---------------------------------------------------------- publicaciones --
-- Línea de tiempo pública de una obra: cada cambio de estado deja una entrada,
-- opcionalmente con texto, fotos y video del candidato.
create table public.publicaciones (
  id                 uuid primary key default gen_random_uuid(),
  ciudad_id          uuid not null references public.ciudades (id) on delete cascade,
  obra_id            uuid references public.obras (id) on delete cascade,
  estado_id          uuid references public.estados (id) on delete set null,
  estado_anterior_id uuid references public.estados (id) on delete set null,
  texto              text not null default '',
  media              jsonb not null default '[]'::jsonb,
  autor_id           uuid references public.admins (id) on delete set null,
  creada_en          timestamptz not null default now()
);

comment on table public.publicaciones is 'Entradas de la línea de tiempo. media: [{tipo:"foto"|"video", url, miniatura}]';

alter table public.publicaciones enable row level security;

create policy "publicaciones de obras visibles visibles para cualquiera"
  on public.publicaciones for select
  using (
    obra_id is null
    or exists (
      select 1 from public.obras o
       where o.id = publicaciones.obra_id
         and o.aprobada
         and o.fusionada_en is null
    )
    or public.es_del_equipo(ciudad_id)
  );

-- Sin política de insert: las publica la RPC admin_obra_cambiar_estado.

-- ============================================================================
-- Triggers
-- ============================================================================

-- Contador de apoyos siempre coherente con la tabla de votos.
create or replace function public.tg_recalcular_apoyos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.obras set apoyos = apoyos + 1, actualizada_en = now() where id = new.obra_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.obras set apoyos = greatest(apoyos - 1, 0), actualizada_en = now() where id = old.obra_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger votos_mantienen_contador
  after insert or delete on public.votos
  for each row execute function public.tg_recalcular_apoyos();

-- Marca de tiempo de la última modificación.
create or replace function public.tg_marcar_actualizacion()
returns trigger
language plpgsql
as $$
begin
  new.actualizada_en := now();
  return new;
end;
$$;

create trigger obras_marcan_actualizacion
  before update on public.obras
  for each row execute function public.tg_marcar_actualizacion();

-- Código corto automático al crear la obra.
create or replace function public.tg_asignar_codigo_obra()
returns trigger
language plpgsql
as $$
begin
  if new.codigo is null or new.codigo = '' then
    new.codigo := public.generar_codigo_obra();
  end if;
  return new;
end;
$$;

create trigger obras_asignan_codigo
  before insert on public.obras
  for each row execute function public.tg_asignar_codigo_obra();

alter table public.obras alter column codigo drop not null;
