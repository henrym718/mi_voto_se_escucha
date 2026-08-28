-- ============================================================================
-- Lo que pasó con lo que yo pedí.
--
-- EL AGUJERO QUE TAPA
--
-- Un vecino publica y la pantalla le dice «recibido». Después, nada. Su pedido
-- entra a la cola del equipo y desde fuera es indistinguible de haberse perdido:
-- no sale en la lista pública —todavía no está aprobado—, no hay correo, no hay
-- notificación, y si alguien lo unificó con otro pedido parecido, su enlace
-- lleva a una obra que ya no se muestra.
--
-- Eso es exactamente la promesa que rompe el producto. Toda la propuesta es
-- «pide y te escuchamos»; si el que pide no puede ver qué pasó con lo suyo, la
-- primera vez es la última.
--
-- Y hay una razón de negocio encima de la de decencia: el que publica es quien
-- va a compartir su pedido en el grupo del barrio para juntar apoyos. Es el
-- mejor vendedor que tiene la plataforma, y hasta ahora no tenía dónde volver.
--
-- CÓMO SE SABE QUIÉN ES
--
-- No hace falta login: el vecino navega con una sesión anónima de Supabase que
-- el navegador crea sola en la primera visita, y `obras.creador_id` guarda ese
-- identificador. La RPC no recibe parámetros a propósito — sale de auth.uid()
-- y no de algo que el cliente pueda mandar, así que nadie puede pedir las
-- propuestas de otro cambiando un id en la petición.
--
-- El límite honesto: si cambia de teléfono o borra los datos del navegador,
-- pierde el hilo. Es el precio de no pedirle una cuenta para participar, y es
-- el trato correcto para un cantón donde registrarse espanta a la mitad.
-- ============================================================================

create or replace function public.mis_propuestas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', true, 'items', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(x order by x_creada desc), '[]'::jsonb)
    into v_items
    from (
      select
        o.creada_en as x_creada,
        jsonb_build_object(
          'id', o.id,
          'codigo', o.codigo,
          -- Sin título todavía: se le enseña lo que él mismo escribió, que es
          -- lo único que reconoce como suyo mientras el equipo lo redacta.
          'titulo', coalesce(nullif(trim(o.titulo), ''),
                             left(coalesce(nullif(trim(o.texto_original), ''),
                                           nullif(trim(o.transcripcion), ''),
                                           'Tu pedido'), 90)),
          'tiene_titulo', nullif(trim(o.titulo), '') is not null,
          'descripcion', o.descripcion,
          'foto_url', o.foto_url,
          'creada_en', o.creada_en,
          'apoyos', o.apoyos,
          'ciudadela', cd.nombre,
          'categoria', ct.nombre,
          -- El orden de los casos importa: una obra unificada suele estar
          -- además aprobada, y lo que le pasó de verdad es que se unificó.
          'situacion', case
            when o.fusionada_en is not null then 'unificada'
            when o.rechazada_en is not null then 'descartada'
            when o.aprobada then 'publicada'
            else 'en_revision'
          end,
          'motivo_rechazo', o.motivo_rechazo,
          'estado', case when o.aprobada and o.fusionada_en is null then
            jsonb_build_object('nombre', e.nombre, 'color', e.color,
                               'descripcion', e.descripcion)
          end,
          -- A dónde fue a parar si la unificaron. Con sus apoyos, que es la
          -- buena noticia: su pedido no se perdió, se hizo más grande.
          'destino', case when o.fusionada_en is not null then (
            select jsonb_build_object('codigo', d.codigo, 'titulo', d.titulo, 'apoyos', d.apoyos)
              from public.obras d where d.id = o.fusionada_en
          ) end
        ) as x
      from public.obras o
      join public.ciudadelas cd on cd.id = o.ciudadela_id
      join public.categorias ct on ct.id = o.categoria_id
      join public.estados    e  on e.id  = o.estado_id
     where o.creador_id = auth.uid()
    ) t;

  return jsonb_build_object('success', true, 'items', v_items);
end;
$$;

comment on function public.mis_propuestas is 'Los pedidos del vecino que llama, con qué pasó con cada uno. Sale de auth.uid(), nunca de un parámetro.';

grant execute on function public.mis_propuestas() to authenticated;
