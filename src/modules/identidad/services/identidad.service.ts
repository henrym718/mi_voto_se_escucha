import { supabaseNavegador } from '@/shared/lib/supabase/client';

/**
 * Identidad del vecino, sin registro.
 *
 * No hay código de verificación en ninguna parte. Al abrir la página, el
 * navegador crea una sesión anónima de Supabase y con eso ya existe un
 * `auth.uid()` estable: el mismo que garantiza "un apoyo por persona", el que
 * nombra su carpeta en storage y el que usan todas las políticas de la base.
 * El vecino no se entera de nada de esto, que es exactamente la idea.
 *
 * El teléfono se pide UNA vez, en el primer apoyo, y ya no se vuelve a pedir:
 * queda en la ficha y —para no parpadear mientras responde el servidor— también
 * marcado en el navegador.
 */

/** Marca local de "a esta persona ya no hay que pedirle el número". */
const CLAVE_CONTACTO = 'mvse:contacto';
/** Último sector elegido, para que el filtro y el formulario lo recuerden. */
const CLAVE_SECTOR = 'mvse:sector';

export function leerLocal(clave: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(clave);
  } catch {
    // Navegador con el almacenamiento bloqueado. Se sigue sin recordar nada.
    return null;
  }
}

function escribirLocal(clave: string, valor: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento, se pierde el atajo pero nada se rompe */
  }
}

export const contactoLocal = {
  hay: () => leerLocal(CLAVE_CONTACTO) === '1',
  marcar: () => escribirLocal(CLAVE_CONTACTO, '1'),
};

export const sectorLocal = {
  leer: () => leerLocal(CLAVE_SECTOR),
  guardar: (id: string) => escribirLocal(CLAVE_SECTOR, id),
};

const CLAVE_ORIGEN = 'mvse:origen';
type Origen = 'directo' | 'qr' | 'compartido';

/**
 * De dónde vino el vecino, recordado hasta que deje su número.
 *
 * El `?via=qr` del cartel solo viaja en la PRIMERA dirección que abre: en
 * cuanto toca una obra, se pierde, y el número lo deja bastante después. Sin
 * guardarlo aquí, la columna `vecinos.origen` diría «directo» para todo el
 * mundo y no habría forma de saber si los cinco mil adhesivos sirvieron.
 */
export const origenLocal = {
  leer: (): Origen => {
    const v = leerLocal(CLAVE_ORIGEN);
    return v === 'qr' || v === 'compartido' ? v : 'directo';
  },
  guardar: (v: Origen) => {
    // 'directo' no se escribe: sería pisar un 'qr' guardado antes con el valor
    // por defecto de cualquier visita posterior.
    if (v !== 'directo') escribirLocal(CLAVE_ORIGEN, v);
  },
};

/**
 * Devuelve la sesión, creándola si hace falta.
 *
 * Se llama en cuanto carga la parte pública, no cuando el vecino toca Apoyar:
 * crear la sesión toma un viaje al servidor, y hacerlo en el momento del toque
 * añadiría medio segundo justo en el único gesto que importa.
 */
export async function asegurarSesion() {
  const supabase = supabaseNavegador();

  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  const { data: nueva, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message);
  return nueva.session;
}

export interface Vecino {
  ciudadela_id: string | null;
  tiene_telefono: boolean;
  quiere_canal: boolean;
}

/** Qué sabemos ya de quien está mirando. `null` si nunca participó. */
export async function vecinoActual(): Promise<Vecino | null> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('vecino_yo');
  if (error) throw new Error(error.message);
  return (data as unknown as { vecino: Vecino | null }).vecino;
}

export interface RespuestaContacto {
  success: boolean;
  error_code?: string;
  enlace_canal?: string | null;
}

/** Lo que graba el modal de un solo campo. */
export async function guardarContacto(entrada: {
  ciudadSlug: string;
  telefono: string;
  ciudadelaId?: string | null;
  quiereCanal?: boolean;
  origen?: 'directo' | 'qr' | 'compartido';
}): Promise<RespuestaContacto> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('vecino_guardar_contacto', {
    p_ciudad_slug: entrada.ciudadSlug,
    p_telefono: entrada.telefono,
    p_ciudadela_id: entrada.ciudadelaId ?? undefined,
    p_quiere_canal: entrada.quiereCanal ?? false,
    p_origen: entrada.origen ?? 'directo',
  });
  if (error) throw new Error(error.message);

  const respuesta = data as unknown as RespuestaContacto;
  if (respuesta.success) contactoLocal.marcar();
  return respuesta;
}

export async function elegirSector(ciudadelaId: string) {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('vecino_elegir_ciudadela', {
    p_ciudadela_id: ciudadelaId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; error_code?: string };
}

/** La usa el panel, no la parte pública: ahí sí hay correo y contraseña. */
export async function cerrarSesion() {
  const supabase = supabaseNavegador();
  await supabase.auth.signOut();
}
