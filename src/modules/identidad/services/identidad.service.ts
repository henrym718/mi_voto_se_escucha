import { supabaseNavegador } from '@/shared/lib/supabase/client';

/**
 * Verificación por WhatsApp.
 *
 * El código NO se genera aquí ni se guarda en ninguna tabla nuestra: lo produce
 * y lo valida Supabase Auth con su flujo nativo de teléfono. Lo único propio es
 * un "Send SMS Hook" que intercepta el código y lo entrega por WhatsApp con
 * Kapso en vez de por SMS. Menos piezas que mantener y menos formas de
 * equivocarse.
 */

export const SEGUNDOS_PARA_REENVIAR = 45;

/**
 * Pide el código. El canal `whatsapp` se manda con un POST crudo porque el SDK
 * de Supabase no expone ese parámetro; si el POST falla se cae a SMS, que es
 * mejor que dejar al vecino sin poder entrar.
 */
/** Error con un motivo que se le puede mostrar tal cual al vecino. */
export class ErrorOtp extends Error {
  constructor(
    public readonly motivo: 'demasiado_pronto' | 'numero_invalido' | 'desconocido',
    mensaje: string,
    /** Segundos que faltan, cuando el servidor los informa. */
    public readonly esperaSegundos?: number,
  ) {
    super(mensaje);
  }
}

export async function pedirCodigo(telefono: string): Promise<void> {
  const respuesta = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone: telefono, channel: 'whatsapp', create_user: true }),
  }).catch(() => null);

  if (respuesta?.ok) return;

  // Pedir dos veces seguidas es lo más común que va a pasar, y merece un
  // mensaje propio: "espera 40 segundos" es accionable, "algo salió mal" no.
  if (respuesta?.status === 429) {
    const cuerpo = await respuesta.json().catch(() => ({}) as { msg?: string });
    const segundos = Number(/after (\d+) seconds/.exec(cuerpo?.msg ?? '')?.[1]);
    throw new ErrorOtp(
      'demasiado_pronto',
      Number.isFinite(segundos)
        ? `Espera ${segundos} segundos antes de pedir otro código.`
        : 'Acabas de pedir un código. Espera un momento antes de pedir otro.',
      Number.isFinite(segundos) ? segundos : undefined,
    );
  }

  // El canal `whatsapp` va por POST crudo porque el SDK no lo expone. Si ese
  // camino falla por otra razón, se reintenta por SMS: es mejor que dejar al
  // vecino sin poder entrar.
  const supabase = supabaseNavegador();
  const { error } = await supabase.auth.signInWithOtp({ phone: telefono });
  if (!error) return;

  if (error.status === 429) {
    throw new ErrorOtp('demasiado_pronto', 'Espera un momento antes de pedir otro código.');
  }
  if (error.message.toLowerCase().includes('phone')) {
    throw new ErrorOtp('numero_invalido', 'Ese número no parece válido. Revísalo e intenta otra vez.');
  }
  throw new ErrorOtp('desconocido', 'No pudimos enviar el código. Intenta otra vez en un momento.');
}

/** `type: 'sms'` también valida los códigos entregados por WhatsApp. */
export async function verificarCodigo(telefono: string, codigo: string): Promise<void> {
  const supabase = supabaseNavegador();
  const { error } = await supabase.auth.verifyOtp({ phone: telefono, token: codigo, type: 'sms' });
  if (error) throw new Error(error.message);
}

export interface Vecino {
  id: string;
  ciudad_id: string;
  ciudadela_id: string | null;
  nombre: string | null;
  necesita_ciudadela: boolean;
  necesita_perfil: boolean;
}

/** Alta idempotente tras verificar. El teléfono se lee del token, no del formulario. */
export async function asegurarVecino(
  ciudadSlug: string,
  ciudadelaId?: string | null,
  origen: 'directo' | 'qr' | 'compartido' = 'directo',
): Promise<Vecino> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('vecino_asegurar', {
    p_ciudad_slug: ciudadSlug,
    p_ciudadela_id: ciudadelaId ?? undefined,
    p_origen: origen,
  });
  if (error) throw new Error(error.message);

  const respuesta = data as unknown as { success: boolean; error_code?: string; vecino?: Vecino };
  if (!respuesta.success || !respuesta.vecino) throw new Error(respuesta.error_code ?? 'error');
  return respuesta.vecino;
}

export async function elegirCiudadela(ciudadelaId: string) {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('vecino_elegir_ciudadela', {
    p_ciudadela_id: ciudadelaId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; error_code?: string };
}

export async function guardarPerfil(perfil: {
  nombre?: string;
  edadRango?: string;
  genero?: string;
}) {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('vecino_perfilar', {
    p_nombre: perfil.nombre ?? undefined,
    p_edad_rango: perfil.edadRango ?? undefined,
    p_genero: perfil.genero ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean };
}

export async function darseDeBaja() {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('vecino_darse_de_baja');
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean };
}

export async function sesionActual() {
  const supabase = supabaseNavegador();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function cerrarSesion() {
  const supabase = supabaseNavegador();
  await supabase.auth.signOut();
}
