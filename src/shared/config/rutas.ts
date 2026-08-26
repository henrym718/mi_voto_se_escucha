/**
 * Todas las rutas en un solo sitio. Nunca escribir un string de ruta suelto en
 * un componente: si mañana cambia una, hay que poder cambiarla aquí y ya.
 */
export const RUTAS = {
  publico: {
    inicio: '/',
    obras: '/obras',
    obra: (codigo: string) => `/o/${codigo}`,
    publicar: '/publicar',
    equipo: '/equipo',
    ajustes: '/ajustes',
  },
  panel: {
    inicio: '/panel',
    tablero: '/panel/tablero',
    cola: '/panel/cola',
    ranking: '/panel/ranking',
    difusion: '/panel/difusion',
    estados: '/panel/estados',
    contenido: '/panel/contenido',
    entrar: '/panel/entrar',
  },
} as const;

/** El enlace absoluto que se comparte al grupo del barrio. */
export function enlaceObra(codigo: string, base?: string): string {
  const raiz = base ?? process.env.NEXT_PUBLIC_SITIO_URL ?? '';
  return `${raiz}${RUTAS.publico.obra(codigo)}`;
}
