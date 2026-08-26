-- ============================================================================
-- Cola de WhatsApp: encolar difusiones, avisar los ingresos al Top 3, y las
-- funciones que usa el worker para drenar la cola.
--
-- El freno de mano vive aquí, no en la interfaz: aunque el equipo insista, un
-- vecino no recibe más de 2 difusiones por semana. Si WhatsApp se siente spam,
-- bloquean el número y el activo del negocio se evapora.
-- ============================================================================

-- Tope de difusiones por vecino por semana. Los avisos de obras que el vecino
-- pidió no cuentan aquí: esos siempre llegan.
create or replace function public.tope_difusiones_semana()
returns integer language sql immutable as $$ select 2 $$;

-- ------------------------------------------------------- admin_difundir --
create or replace function public.admin_difundir(
  p_ciudad_id     uuid,
  p_mensaje       text,
  p_ciudadela_ids uuid[] default null,
  p_categoria_ids uuid[] default null,
  p_boton_path    text default null,
  p_simular       boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alcance   integer := 0;
  v_frenados  integer := 0;
  v_encoladas integer := 0;
  v_ciudad    public.ciudades;
begin
  if not public.puede_editar(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;
  if length(trim(coalesce(p_mensaje, ''))) < 10 then
    return jsonb_build_object('success', false, 'error_code', 'mensaje_muy_corto');
  end if;

  select * into v_ciudad from public.ciudades where id = p_ciudad_id;

  -- Destinatarios: vecinos de la ciudad que aceptan avisos, filtrados por
  -- ciudadela y por interés (haber apoyado algo de esa categoría).
  create temp table if not exists destinatarios_difusion (
    vecino_id uuid, telefono text, frenado boolean
  ) on commit drop;
  delete from destinatarios_difusion;

  insert into destinatarios_difusion (vecino_id, telefono, frenado)
  select v.id,
         v.telefono,
         public.mensajes_ultima_semana(v.id) >= public.tope_difusiones_semana()
    from public.vecinos v
   where v.ciudad_id = p_ciudad_id
     and v.consentimiento_notif
     and v.baja_en is null
     and (p_ciudadela_ids is null or v.ciudadela_id = any (p_ciudadela_ids))
     and (
       p_categoria_ids is null
       or exists (
         select 1
           from public.votos vo
           join public.obras o on o.id = vo.obra_id
          where vo.vecino_id = v.id
            and o.categoria_id = any (p_categoria_ids)
       )
     );

  select count(*)::integer into v_alcance from destinatarios_difusion;
  select count(*)::integer into v_frenados from destinatarios_difusion where frenado;

  -- Modo simulación: el panel muestra alcance y costo antes de enviar nada.
  if p_simular then
    return jsonb_build_object(
      'success', true,
      'simulacion', true,
      'alcance', v_alcance - v_frenados,
      'frenados_por_tope', v_frenados,
      'costo_estimado', round(((v_alcance - v_frenados) * 0.008)::numeric, 2)
    );
  end if;

  insert into public.notificaciones (
    ciudad_id, vecino_id, telefono, plantilla, params, boton_path, origen_tipo
  )
  select p_ciudad_id, d.vecino_id, d.telefono, 'difusion',
         jsonb_build_object('mensaje', left(trim(p_mensaje), 600), 'ciudad', v_ciudad.nombre),
         p_boton_path, 'difusion'
    from destinatarios_difusion d
   where not d.frenado;

  get diagnostics v_encoladas = row_count;

  perform public.anotar_bitacora(
    p_ciudad_id, 'difundir', 'notificaciones', null,
    jsonb_build_object('encoladas', v_encoladas, 'frenados', v_frenados,
                       'ciudadelas', p_ciudadela_ids, 'categorias', p_categoria_ids)
  );

  return jsonb_build_object(
    'success', true,
    'encoladas', v_encoladas,
    'frenados_por_tope', v_frenados,
    'costo_estimado', round((v_encoladas * 0.008)::numeric, 2)
  );
end;
$$;

comment on function public.admin_difundir is 'Encola una difusión segmentada. Con p_simular muestra alcance y costo sin enviar.';

-- ------------------------------------------------ avisos de entrada al Top --
-- Retención sin que el equipo mueva un dedo: cuando una obra entra al Top 3
-- de su ciudadela, quienes la apoyaron se enteran. Se avisa una sola vez.
create or replace function public.notificar_ingresos_top(p_ciudad_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encoladas integer := 0;
  v_obras     integer := 0;
begin
  with ranking as (
    select o.id,
           o.titulo,
           o.codigo,
           o.ciudad_id,
           o.ciudadela_id,
           row_number() over (partition by o.ciudadela_id order by o.apoyos desc, o.creada_en asc) as posicion
      from public.obras o
     where o.aprobada and o.fusionada_en is null and o.rechazada_en is null
       and (p_ciudad_id is null or o.ciudad_id = p_ciudad_id)
  ),
  nuevas as (
    select r.* from ranking r
      join public.obras o on o.id = r.id
     where r.posicion <= 3
       and o.top_avisado_en is null
       and o.apoyos >= 10   -- sin un mínimo, el Top 3 de un barrio vacío no significa nada
  ),
  marcadas as (
    update public.obras o
       set top_avisado_en = now()
      from nuevas n
     where o.id = n.id
     returning o.id
  ),
  encoladas as (
    insert into public.notificaciones (
      ciudad_id, vecino_id, telefono, plantilla, params, boton_path, origen_tipo, origen_id
    )
    select n.ciudad_id, ve.id, ve.telefono, 'obra_top',
           jsonb_build_object(
             'obra', n.titulo,
             'posicion', n.posicion,
             'ciudadela', (select nombre from public.ciudadelas where id = n.ciudadela_id)
           ),
           'o/' || n.codigo, 'obra', n.id
      from nuevas n
      join public.votos vo on vo.obra_id = n.id
      join public.vecinos ve on ve.id = vo.vecino_id
     where ve.consentimiento_notif and ve.baja_en is null
    returning 1
  )
  select (select count(*) from nuevas), (select count(*) from encoladas)
    into v_obras, v_encoladas;

  return jsonb_build_object('success', true, 'obras', v_obras, 'notificaciones', v_encoladas);
end;
$$;

-- ============================================================================
-- Funciones del worker. Solo service_role.
-- ============================================================================

-- Reclama un lote de forma atómica: dos workers simultáneos nunca toman la
-- misma fila gracias a `for update skip locked`.
create or replace function public.notif_reclamar_lote(p_limite integer default 25)
returns setof public.notificaciones
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notificaciones n
     set estado = 'enviando'
   where n.id in (
     select id from public.notificaciones
      where estado = 'pendiente' and programada_para <= now()
      order by programada_para
      limit greatest(p_limite, 1)
      for update skip locked
   )
  returning n.*;
end;
$$;

create or replace function public.notif_marcar_enviada(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notificaciones
     set estado = 'enviado', enviada_en = now(), intentos = intentos + 1, ultimo_error = null
   where id = p_id;
$$;

-- Reintentos con espera creciente: 2, 10 y 30 minutos. Al cuarto fallo se
-- marca como fallida y queda para revisión; no se pierde en silencio.
create or replace function public.notif_marcar_fallida(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intentos integer;
  v_espera   integer;
begin
  select intentos + 1 into v_intentos from public.notificaciones where id = p_id;

  v_espera := case v_intentos when 1 then 2 when 2 then 10 when 3 then 30 else null end;

  if v_espera is null then
    update public.notificaciones
       set estado = 'fallido', intentos = v_intentos, ultimo_error = left(coalesce(p_error, ''), 500)
     where id = p_id;
  else
    update public.notificaciones
       set estado = 'pendiente',
           intentos = v_intentos,
           ultimo_error = left(coalesce(p_error, ''), 500),
           programada_para = now() + (v_espera || ' minutes')::interval
     where id = p_id;
  end if;
end;
$$;

revoke all on function public.notif_reclamar_lote(integer) from public, anon, authenticated;
revoke all on function public.notif_marcar_enviada(uuid) from public, anon, authenticated;
revoke all on function public.notif_marcar_fallida(uuid, text) from public, anon, authenticated;
revoke all on function public.notificar_ingresos_top(uuid) from public, anon, authenticated;
grant execute on function public.notif_reclamar_lote(integer) to service_role;
grant execute on function public.notif_marcar_enviada(uuid) to service_role;
grant execute on function public.notif_marcar_fallida(uuid, text) to service_role;
grant execute on function public.notificar_ingresos_top(uuid) to service_role;

-- --------------------------------------------------- alcance para el panel --
create or replace function public.admin_alcance(p_ciudad_id uuid, p_dias integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_del_equipo(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  return jsonb_build_object(
    'success', true,
    'por_estado', (
      select coalesce(jsonb_object_agg(estado, total), '{}'::jsonb)
        from (
          select estado, count(*) as total
            from public.notificaciones
           where ciudad_id = p_ciudad_id
             and creada_en > now() - (greatest(p_dias, 1) || ' days')::interval
           group by estado
        ) t
    ),
    'bajas', (select count(*) from public.vecinos where ciudad_id = p_ciudad_id and baja_en is not null),
    'costo_periodo', (
      select round((count(*) * 0.008)::numeric, 2)
        from public.notificaciones
       where ciudad_id = p_ciudad_id and estado = 'enviado'
         and creada_en > now() - (greatest(p_dias, 1) || ' days')::interval
    )
  );
end;
$$;
