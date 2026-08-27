-- ============================================================================
-- WhatsApp a costo cero.
--
-- Aquí vivía la cola de envíos. Se fue: a 2-5 centavos por mensaje, avisar cada
-- cambio de estado a mil vecinos se come el presupuesto de campaña en ruido
-- que nadie pidió. Lo que queda es apalancamiento puro, de uno a muchos:
--
--   · Cada sector tiene su canal de WhatsApp, creado a mano una sola vez.
--   · El equipo pega ese enlace en el panel.
--   · El vecino que acaba de apoyar o publicar ve un botón y entra solo.
--
-- Y para el trabajo de territorio —llamar, convocar, armar la brigada— el
-- equipo exporta los números de un sector desde el panel, con la salvedad de
-- que esa lista sale de la base y queda anotada en la bitácora.
-- ============================================================================

-- ------------------------------------------------------- admin_canales --
-- Guarda el enlace de canal de cada sector. Recibe solo los que cambiaron.
create or replace function public.admin_canales_guardar(
  p_ciudad_id uuid,
  p_canales   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item     jsonb;
  v_enlace   text;
  v_tocados  integer := 0;
begin
  if not public.puede_editar(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  for v_item in select * from jsonb_array_elements(p_canales) loop
    v_enlace := nullif(trim(coalesce(v_item ->> 'enlace_canal', '')), '');

    -- Un enlace que no es de WhatsApp manda al vecino a cualquier parte desde
    -- la pantalla de éxito. Se rechaza el lote entero antes que guardar uno malo.
    if v_enlace is not null and v_enlace !~* '^https://(chat\.whatsapp\.com|whatsapp\.com/channel)/' then
      return jsonb_build_object('success', false, 'error_code', 'enlace_invalido',
                                'detalle', v_item ->> 'nombre');
    end if;

    update public.ciudadelas
       set enlace_canal = v_enlace
     where id = (v_item ->> 'id')::uuid and ciudad_id = p_ciudad_id;

    if found then v_tocados := v_tocados + 1; end if;
  end loop;

  perform public.anotar_bitacora(p_ciudad_id, 'guardar_canales', 'ciudadelas', null,
                                 jsonb_build_object('sectores', v_tocados));

  return jsonb_build_object('success', true, 'sectores', v_tocados);
end;
$$;

comment on function public.admin_canales_guardar is 'Enlace del canal de WhatsApp por sector. Solo acepta enlaces de WhatsApp.';

-- ----------------------------------------------------- admin_canales_listar --
-- Los sectores con su enlace y cuánta gente espera entrar en cada uno.
create or replace function public.admin_canales_listar(p_ciudad_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  if not public.es_del_equipo(p_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', cd.id,
             'nombre', cd.nombre,
             'enlace_canal', cd.enlace_canal,
             'contactos', (
               select count(*) from public.vecinos v
                where v.ciudadela_id = cd.id and v.telefono is not null
             ),
             'esperando', (
               select count(*) from public.vecinos v
                where v.ciudadela_id = cd.id and v.telefono is not null and v.quiere_canal
             )
           ) order by cd.nombre
         ), '[]'::jsonb)
    into v_items
    from public.ciudadelas cd
   where cd.ciudad_id = p_ciudad_id and cd.activa;

  return jsonb_build_object('success', true, 'items', v_items);
end;
$$;

-- --------------------------------------------------------- admin_contactos --
-- La lista de números de un sector, para el trabajo de territorio.
--
-- Es la única puerta por la que salen teléfonos del sistema, y por eso: la
-- abre solo quien puede editar, pide un sector concreto (nunca "todo el
-- cantón" de un tirón) y deja constancia en la bitácora de quién la usó.
create or replace function public.admin_contactos_sector(
  p_ciudadela_id uuid,
  p_solo_canal   boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ciudad_id uuid;
  v_items     jsonb;
begin
  select cd.ciudad_id into v_ciudad_id from public.ciudadelas cd where cd.id = p_ciudadela_id;
  if v_ciudad_id is null then
    return jsonb_build_object('success', false, 'error_code', 'ciudadela_invalida');
  end if;
  if not public.puede_editar(v_ciudad_id) then
    return jsonb_build_object('success', false, 'error_code', 'sin_permiso');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'telefono', v.telefono,
             'quiere_canal', v.quiere_canal,
             'apoyos', (select count(*) from public.votos vo where vo.vecino_id = v.id),
             'desde', v.creado_en
           ) order by v.creado_en desc
         ), '[]'::jsonb)
    into v_items
    from public.vecinos v
   where v.ciudadela_id = p_ciudadela_id
     and v.telefono is not null
     and (not p_solo_canal or v.quiere_canal);

  perform public.anotar_bitacora(
    v_ciudad_id, 'exportar_contactos', 'ciudadela', p_ciudadela_id,
    jsonb_build_object('total', jsonb_array_length(v_items), 'solo_canal', p_solo_canal)
  );

  return jsonb_build_object('success', true, 'items', v_items);
end;
$$;

comment on function public.admin_contactos_sector is 'Única salida de teléfonos del sistema. Por sector, solo editores, y queda en bitácora.';
