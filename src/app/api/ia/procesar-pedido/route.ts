import { after } from 'next/server';
import { NextResponse } from 'next/server';

import { limitar } from '@/modules/ia/services/limite.server';
import { redactarPedido } from '@/modules/ia/services/redaccion.server';
import { transcribirAudio } from '@/modules/ia/services/transcripcion.server';
import { supabaseAdmin, supabaseServidor } from '@/shared/lib/supabase/server';

/**
 * Ordena un pedido recién entrado: oye la nota de voz y redacta el título y la
 * descripción que verá el equipo en la cola.
 *
 * El vecino NO espera nada de esto. Ya vio su pantalla de "recibido" y cerró la
 * aplicación; el trabajo pesado ocurre después de responderle, con `after`, y
 * si falla la obra queda marcada `fallido` y el equipo la redacta a mano. Nunca
 * se pierde un pedido por culpa de un proveedor caído.
 *
 * Quien llama es el propio vecino que acaba de publicar, y por eso lo primero
 * que se comprueba es que la obra sea suya: el resto de la función gasta plata
 * en dos APIs y no puede dispararla cualquiera con un uuid.
 */
export async function POST(peticion: Request) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error_code: 'sin_sesion' }, { status: 401 });
  }

  let obraId: string;
  try {
    obraId = ((await peticion.json()) as { obraId?: string }).obraId ?? '';
  } catch {
    return NextResponse.json({ success: false, error_code: 'cuerpo_invalido' }, { status: 400 });
  }
  if (!obraId) {
    return NextResponse.json({ success: false, error_code: 'cuerpo_invalido' }, { status: 400 });
  }

  // El tope va por persona: tres pedidos al día por vecino ya lo limita la
  // base, y esto ataja el bucle accidental del navegador que reintenta solo.
  if (!limitar(`procesar:${user.id}`, 10)) {
    return NextResponse.json({ success: false, error_code: 'demasiados_intentos' }, { status: 429 });
  }

  const admin = supabaseAdmin();
  const { data: obra } = await admin
    .from('obras')
    .select('id, creador_id, ia_estado, audio_url, texto_original, ciudadela_id, categoria_id')
    .eq('id', obraId)
    .single();

  if (!obra || obra.creador_id !== user.id) {
    return NextResponse.json({ success: false, error_code: 'obra_no_encontrada' }, { status: 404 });
  }
  // Ya procesada: responder que sí, sin volver a gastar en las dos APIs.
  if (obra.ia_estado !== 'pendiente') {
    return NextResponse.json({ success: true, ya_procesada: true });
  }

  after(async () => {
    try {
      const [{ data: ciudadela }, { data: categoria }] = await Promise.all([
        admin.from('ciudadelas').select('nombre').eq('id', obra.ciudadela_id).single(),
        admin.from('categorias').select('nombre').eq('id', obra.categoria_id).single(),
      ]);

      // Whisper oye la nota; si el vecino escribió, ese texto manda y no se
      // gasta una transcripción.
      let transcripcion: string | null = null;
      let mensaje = (obra.texto_original ?? '').trim();

      if (!mensaje && obra.audio_url) {
        const { data: audio, error } = await admin.storage.from('notas').download(obra.audio_url);
        if (error || !audio) throw new Error(`no se pudo bajar la nota: ${error?.message}`);

        transcripcion = await transcribirAudio(
          new File([audio], obra.audio_url.split('/').pop() ?? 'nota.webm', { type: audio.type }),
        );
        mensaje = transcripcion;
      }

      if (mensaje.trim().length < 10) throw new Error('no hay suficiente para redactar');

      const redactado = await redactarPedido({
        mensaje,
        ciudadela: ciudadela?.nombre,
        categoria: categoria?.nombre,
      });

      await admin.rpc('obra_ia_resultado', {
        p_obra_id: obraId,
        p_titulo: redactado.titulo,
        p_descripcion: redactado.descripcion,
        p_transcripcion: transcripcion ?? undefined,
        // `necesita_mas` significa que el modelo no entendió qué hace falta.
        // Antes eso frenaba al vecino con una repregunta; ahora simplemente
        // llega a la cola con lo que dijo y lo resuelve una persona.
        p_fallo: redactado.necesita_mas,
      });
    } catch (error) {
      // El detalle se queda en el servidor: lleva lo que contó el vecino.
      console.error('[ia/procesar-pedido]', error);
      await admin.rpc('obra_ia_resultado', {
        p_obra_id: obraId,
        p_titulo: '',
        p_descripcion: '',
        p_fallo: true,
      });
    }
  });

  return NextResponse.json({ success: true }, { status: 202 });
}
