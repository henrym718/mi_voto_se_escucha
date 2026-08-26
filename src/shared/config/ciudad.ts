import { headers } from 'next/headers';

/**
 * Resolución del inquilino: cada ciudad tiene su propio dominio y el mismo
 * código sirve a todas. mivotoseescucha-eltriunfo.com -> 'el-triunfo'.
 *
 * Vender una ciudad nueva es comprar un dominio, apuntarlo aquí y cargar sus
 * datos desde el panel. Cero despliegues, cero ramas de código.
 */
const DOMINIOS: Record<string, string> = {
  'mivotoseescucha-eltriunfo.com': 'el-triunfo',
  'www.mivotoseescucha-eltriunfo.com': 'el-triunfo',
  'mivotoseescucha-latroncal.com': 'la-troncal',
  'www.mivotoseescucha-latroncal.com': 'la-troncal',
};

/** En desarrollo no hay dominio real: manda la variable de entorno. */
const CIUDAD_POR_DEFECTO = process.env.NEXT_PUBLIC_CIUDAD_POR_DEFECTO ?? 'el-triunfo';

export async function ciudadActual(): Promise<string> {
  const cabeceras = await headers();
  const host = (cabeceras.get('x-forwarded-host') ?? cabeceras.get('host') ?? '')
    .toLowerCase()
    .split(':')[0];

  if (DOMINIOS[host]) return DOMINIOS[host];

  // Despliegues de vista previa: el-triunfo.vercel.app, el-triunfo.localhost…
  const primerNivel = host.split('.')[0];
  if (primerNivel && primerNivel !== 'localhost' && primerNivel !== 'www' && Object.values(DOMINIOS).includes(primerNivel)) {
    return primerNivel;
  }

  return CIUDAD_POR_DEFECTO;
}

export function ciudadDesdeHost(host: string): string {
  const limpio = host.toLowerCase().split(':')[0];
  return DOMINIOS[limpio] ?? CIUDAD_POR_DEFECTO;
}
