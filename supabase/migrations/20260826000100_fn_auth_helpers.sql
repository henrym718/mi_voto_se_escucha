-- ============================================================================
-- Helpers de autorización usados por las políticas RLS y por las RPC.
--
-- Van en security definer para poder consultar `admins` / `vecinos` sin quedar
-- atrapados en las políticas RLS de esas mismas tablas (recursión infinita).
-- Se crean ANTES que las tablas a propósito: el cuerpo plpgsql se resuelve en
-- tiempo de ejecución, y así las políticas de las tablas pueden invocarlos ya
-- en su propia migración.
-- ============================================================================

-- Rol del usuario autenticado dentro de una ciudad. null si no es del equipo.
create or replace function public.rol_admin_en(p_ciudad_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select a.rol
    into v_rol
    from public.admins a
   where a.id = auth.uid()
     and a.ciudad_id = p_ciudad_id
     and a.activo;

  return v_rol;
end;
$$;

-- ¿Puede escribir? admin y editor sí; el candidato es solo lectura.
--
-- El coalesce NO es cosmético. Sin él, `rol in ('admin','editor')` devuelve
-- NULL cuando el usuario no es del equipo, y en las RPC un
-- `if not puede_editar(...) then return sin_permiso; end if;` NO se cumple con
-- NULL: la función seguiría de largo y dejaría pasar la escritura. Toda
-- función de permiso de este archivo devuelve true o false, nunca NULL.
create or replace function public.puede_editar(p_ciudad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_admin_en(p_ciudad_id) in ('admin', 'editor'), false);
$$;

-- ¿Pertenece al equipo de la ciudad, con cualquier rol?
create or replace function public.es_del_equipo(p_ciudad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_admin_en(p_ciudad_id) is not null, false);
$$;

-- Solo el rol de mayor privilegio.
create or replace function public.es_admin(p_ciudad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_admin_en(p_ciudad_id) = 'admin', false);
$$;

-- Ciudadela del vecino autenticado. Define dónde puede votar.
create or replace function public.ciudadela_del_vecino()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ciudadela uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select v.ciudadela_id
    into v_ciudadela
    from public.vecinos v
   where v.id = auth.uid();

  return v_ciudadela;
end;
$$;

-- Ciudad del vecino autenticado.
create or replace function public.ciudad_del_vecino()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ciudad uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select v.ciudad_id
    into v_ciudad
    from public.vecinos v
   where v.id = auth.uid();

  return v_ciudad;
end;
$$;

-- Normaliza un teléfono ecuatoriano a E.164 (+593XXXXXXXXX).
-- Acepta 0991234567, 991234567, 593991234567, +593 99 123 4567.
-- Devuelve null si no es un celular ecuatoriano válido.
create or replace function public.normalizar_telefono(p_telefono text)
returns text
language plpgsql
immutable
as $$
declare
  v_digitos text;
begin
  if p_telefono is null then
    return null;
  end if;

  v_digitos := regexp_replace(p_telefono, '[^0-9]', '', 'g');

  -- 593 + 9 dígitos que empiezan en 9  ->  ya viene con código de país
  if length(v_digitos) = 12 and left(v_digitos, 3) = '593' and substr(v_digitos, 4, 1) = '9' then
    return '+' || v_digitos;
  end if;

  -- 0 + 9 dígitos que empiezan en 9  ->  formato nacional
  if length(v_digitos) = 10 and left(v_digitos, 2) = '09' then
    return '+593' || right(v_digitos, 9);
  end if;

  -- 9 dígitos que empiezan en 9  ->  sin cero inicial
  if length(v_digitos) = 9 and left(v_digitos, 1) = '9' then
    return '+593' || v_digitos;
  end if;

  return null;
end;
$$;

-- Convierte un nombre en slug: quita tildes, baja a minúsculas y une con guiones.
-- Sin depender de la extensión unaccent, que no siempre está disponible.
create or replace function public.slugificar(p_texto text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      lower(translate(coalesce(p_texto, ''),
                      'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                      'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

comment on function public.rol_admin_en is 'Rol del usuario autenticado en una ciudad, o null si no es del equipo.';
comment on function public.puede_editar is 'admin y editor pueden escribir; candidato es solo lectura.';
comment on function public.normalizar_telefono is 'Normaliza celulares ecuatorianos a E.164. null si no es válido.';
