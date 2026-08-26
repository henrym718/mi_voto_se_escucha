// ============================================================================
// "Send SMS Hook" de Supabase Auth -> Kapso -> WhatsApp.
//
// Flujo: la web llama a /auth/v1/otp con channel "whatsapp". Supabase Auth
// genera y guarda el código, y en vez de mandarlo por SMS llama a esta función
// con { user, sms: { otp } }. Aquí se verifica la firma y se entrega por
// WhatsApp con la API de Kapso (que es un proxy del Cloud API de Meta).
//
// El código NO se genera ni se guarda aquí: eso es cosa de gotrue. Esta función
// solo lo transporta.
//
// Secretos (nunca en el código ni en git):
//   SEND_SMS_HOOK_SECRET    formato "v1,whsec_..." — el mismo con que se
//                           registró el hook en la configuración de auth
//   KAPSO_API_KEY           clave de la cuenta de Kapso
//   KAPSO_PHONE_NUMBER_ID   id del número emisor (NO el de la cuenta)
//
// La plantilla, el idioma y el host van fijos a propósito. Un secreto vacío o
// mal escrito produce un 502 opaco que cuesta horas encontrar; como constantes,
// eso no puede pasar.
// ============================================================================

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const SECRETO_HOOK = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
const KAPSO_API_KEY = Deno.env.get('KAPSO_API_KEY') ?? '';
const KAPSO_PHONE_NUMBER_ID = Deno.env.get('KAPSO_PHONE_NUMBER_ID') ?? '';
const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const KAPSO_BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0';
// Plantilla de tipo AUTHENTICATION aprobada en Meta. El idioma es "es"
// ("Spanish"), nunca "es_ES": con el código equivocado Meta responde 132001.
const PLANTILLA = Deno.env.get('KAPSO_OTP_TEMPLATE') ?? 'mvse_otp';
const IDIOMA = 'es';

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (peticion) => {
  const cuerpo = await peticion.text();
  const cabeceras = Object.fromEntries(peticion.headers);

  // 1) Verificar que de verdad viene de Supabase Auth.
  let user: { phone?: string };
  let sms: { otp: string };
  try {
    const webhook = new Webhook(SECRETO_HOOK);
    ({ user, sms } = webhook.verify(cuerpo, cabeceras) as {
      user: { phone?: string };
      sms: { otp: string };
    });
  } catch {
    return json({ error: { http_code: 401, message: 'firma inválida' } }, 401);
  }

  const codigo = sms?.otp;
  // Meta exige solo dígitos, sin el "+".
  const destino = (user?.phone ?? '').replace(/\D/g, '');
  if (!destino || !codigo) {
    return json({ error: { http_code: 400, message: 'falta teléfono o código' } }, 400);
  }

  // 2) Límite propio por teléfono. Supabase limita por IP, y sin esto se puede
  //    bombardear UN número desde muchas IPs: spam al vecino y riesgo de que
  //    Meta bloquee el número emisor de toda la plataforma.
  //
  //    Si la base responde con error, NO se envía: un limitador que se puede
  //    tumbar no limita nada. Si la base no responde (caída de red entre la
  //    función y Postgres) sí se envía, porque un corte momentáneo no debe
  //    dejar a toda la ciudad sin poder entrar; los límites por IP siguen ahí.
  try {
    const respuesta = await fetch(`${URL_SUPABASE}/rest/v1/rpc/otp_limite_ok`, {
      method: 'POST',
      headers: {
        apikey: CLAVE_SERVICIO,
        Authorization: `Bearer ${CLAVE_SERVICIO}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_telefono: `+${destino}` }),
    });

    if (!respuesta.ok) {
      console.error('límite de OTP respondió error', respuesta.status, '→ no se envía');
      return json(
        { error: { http_code: 429, message: 'no se pudo validar el límite, intenta de nuevo' } },
        429,
      );
    }
    if ((await respuesta.json()) === false) {
      console.warn('límite de OTP alcanzado para', `${destino.slice(0, 6)}***`);
      return json(
        { error: { http_code: 429, message: 'pediste demasiados códigos, espera un momento' } },
        429,
      );
    }
  } catch (e) {
    console.error('límite de OTP inalcanzable; se envía igual', e);
  }

  // 3) Enviar por WhatsApp. El código va en el cuerpo y en el botón de copiar,
  //    que es como Meta define las plantillas de autenticación.
  const mensaje = {
    messaging_product: 'whatsapp',
    to: destino,
    type: 'template',
    template: {
      name: PLANTILLA,
      language: { code: IDIOMA },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: codigo }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: codigo }],
        },
      ],
    },
  };

  const envio = await fetch(`${KAPSO_BASE}/${KAPSO_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'X-API-Key': KAPSO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(mensaje),
  });

  if (!envio.ok) {
    // Guardar el cuerpo crudo: sin esto, un id de número vacío se ve como un
    // 404 genérico y no hay forma de saber qué pasó.
    const detalle = await envio.text().catch(() => '');
    console.error('Kapso respondió', envio.status, detalle);
    return json(
      { error: { http_code: 502, message: `error enviando WhatsApp: ${envio.status}` } },
      502,
    );
  }

  // Supabase espera un objeto vacío con 200.
  return json({});
});
