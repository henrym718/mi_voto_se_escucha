// ============================================================================
// Drena la cola de notificaciones y las entrega por WhatsApp vía Kapso.
//
// Lo invoca un cron cada minuto. Toma un lote, intenta enviarlo, y marca cada
// mensaje como enviado o fallido; los fallos vuelven a la cola con espera
// creciente (2, 10 y 30 minutos) y al cuarto quedan marcados para revisión.
// Nada se pierde en silencio.
//
// Por qué existe la cola: un cambio de estado puede avisar a cuatrocientas
// personas. Enviarlas dentro de la petición del panel la haría esperar medio
// minuto o reventar por tiempo de espera. Encolar responde al instante.
// ============================================================================

const KAPSO_API_KEY = Deno.env.get('KAPSO_API_KEY') ?? '';
const KAPSO_PHONE_NUMBER_ID = Deno.env.get('KAPSO_PHONE_NUMBER_ID') ?? '';
const KAPSO_BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0';
// Cada ambiente tiene su propio juego de plantillas aprobadas en Meta.
const PREFIJO = Deno.env.get('KAPSO_TEMPLATE_PREFIX') ?? 'mvse_staging';
const IDIOMA = Deno.env.get('KAPSO_TEMPLATE_LANG') ?? 'es';
const URL_BASE_APP = (Deno.env.get('APP_BASE_URL') ?? '').replace(/\/$/, '');

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SECRETO_WORKER = Deno.env.get('WORKER_SECRET') ?? '';

const TAMANO_LOTE = 25;

interface Notificacion {
  id: string;
  telefono: string;
  plantilla: string;
  params: Record<string, string>;
  boton_path: string | null;
}

async function rpc<T>(nombre: string, cuerpo: unknown): Promise<T> {
  const respuesta = await fetch(`${URL_SUPABASE}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers: {
      apikey: CLAVE_SERVICIO,
      Authorization: `Bearer ${CLAVE_SERVICIO}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  });
  if (!respuesta.ok) {
    throw new Error(`${nombre}: HTTP ${respuesta.status} ${await respuesta.text()}`);
  }
  return (await respuesta.json()) as T;
}

/**
 * Meta rechaza parámetros con saltos de línea, tabulaciones o varios espacios
 * seguidos. Un vecino escribe como escribe, así que se aplana antes de enviar.
 */
function limpiar(valor: unknown): string {
  return String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function enviarPorKapso(notificacion: Notificacion): Promise<void> {
  if (!KAPSO_API_KEY || !KAPSO_PHONE_NUMBER_ID) {
    throw new Error('Faltan credenciales de Kapso (KAPSO_API_KEY o KAPSO_PHONE_NUMBER_ID)');
  }

  const destino = notificacion.telefono.replace(/\D/g, '');
  if (!destino) throw new Error('notificación sin teléfono utilizable');

  const componentes: unknown[] = [
    {
      type: 'body',
      parameters: Object.entries(notificacion.params).map(([nombre, valor]) => ({
        type: 'text',
        parameter_name: nombre,
        text: limpiar(valor),
      })),
    },
  ];

  // La plantilla lleva la base del dominio fija y una sola variable al final,
  // que es la única forma que Meta admite para botones de enlace.
  if (notificacion.boton_path) {
    componentes.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: limpiar(notificacion.boton_path) }],
    });
  }

  const respuesta = await fetch(`${KAPSO_BASE}/${KAPSO_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'X-API-Key': KAPSO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: destino,
      type: 'template',
      template: {
        name: `${PREFIJO}_${notificacion.plantilla}`,
        language: { code: IDIOMA },
        components: componentes,
      },
    }),
  });

  if (!respuesta.ok) {
    const crudo = await respuesta.text().catch(() => '');
    let detalle = `HTTP ${respuesta.status}`;
    try {
      const error = JSON.parse(crudo);
      detalle = error?.error?.message ?? error?.message ?? detalle;
    } catch {
      if (crudo) detalle = crudo;
    }
    throw new Error(`Kapso (${respuesta.status}) :: ${detalle}`);
  }
}

Deno.serve(async (peticion) => {
  // Solo lo llama el cron con el secreto compartido.
  const cabecera = peticion.headers.get('Authorization') ?? '';
  const token = cabecera.replace(/^Bearer\s+/i, '');
  if (!SECRETO_WORKER || token !== SECRETO_WORKER) {
    return new Response(JSON.stringify({ error: 'no autorizado' }), { status: 401 });
  }

  let enviados = 0;
  let fallidos = 0;

  try {
    // Antes de drenar: avisar a las obras que acaban de entrar al Top 3. Va
    // aquí y no en un cron aparte porque siempre corren juntas.
    await rpc('notificar_ingresos_top', { p_ciudad_id: null }).catch((e) =>
      console.error('avisos de Top fallaron', e),
    );

    const lote = await rpc<Notificacion[]>('notif_reclamar_lote', { p_limite: TAMANO_LOTE });

    for (const notificacion of lote) {
      try {
        // Si no hay dominio configurado el botón queda inservible, así que se
        // manda el aviso sin botón antes que con un enlace roto.
        if (!URL_BASE_APP) notificacion.boton_path = null;

        await enviarPorKapso(notificacion);
        await rpc('notif_marcar_enviada', { p_id: notificacion.id });
        enviados++;
      } catch (e) {
        await rpc('notif_marcar_fallida', {
          p_id: notificacion.id,
          p_error: e instanceof Error ? e.message : String(e),
        });
        fallidos++;
      }
    }
  } catch (e) {
    console.error('el worker no pudo drenar la cola', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ enviados, fallidos }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
