import 'server-only';

/**
 * Freno de mano por usuario para las rutas que cuestan plata.
 *
 * Vive en memoria del proceso a propósito: no es una defensa contra un ataque
 * distribuido — para eso está el WAF del proveedor — sino contra el bucle
 * accidental y contra el vecino que se queda apretando "Mejorar" veinte veces
 * porque la red va lenta. En serverless cada instancia lleva su cuenta, y para
 * ese trabajo alcanza y sobra sin montar Redis.
 */

const VENTANA_MS = 10 * 60 * 1000;

const registro = new Map<string, number[]>();

/** Devuelve false cuando la clave ya gastó su cupo en los últimos diez minutos. */
export function limitar(clave: string, maximo: number): boolean {
  const ahora = Date.now();
  const previos = (registro.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS);

  if (previos.length >= maximo) {
    registro.set(clave, previos);
    return false;
  }

  previos.push(ahora);
  registro.set(clave, previos);

  // Barrido barato: sin esto el mapa crece con cada usuario que pasó una vez.
  if (registro.size > 5000) {
    for (const [k, marcas] of registro) {
      if (marcas.every((t) => ahora - t >= VENTANA_MS)) registro.delete(k);
    }
  }

  return true;
}
