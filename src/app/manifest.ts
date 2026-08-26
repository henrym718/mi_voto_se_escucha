import type { MetadataRoute } from 'next';

import { ciudadActual } from '@/shared/config/ciudad';
import { supabaseServidor } from '@/shared/lib/supabase/server';

/**
 * Lo que convierte la web en algo instalable: al vecino que vuelve, el
 * navegador le ofrece "Agregar a inicio" y le queda un ícono como si fuera una
 * app. Sin tienda de aplicaciones y sin que nadie descargue nada.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const slug = await ciudadActual();
  const supabase = await supabaseServidor();
  const { data } = await supabase.rpc('ciudad_portada', { p_ciudad_slug: slug });
  const portada = data as { ciudad?: { nombre?: string }; portal?: { color_marca?: string } } | null;

  const nombreCiudad = portada?.ciudad?.nombre ?? 'Mi ciudad';

  return {
    name: `Mi Voto Se Escucha · ${nombreCiudad}`,
    short_name: 'Mi Voto',
    description: `Pide y apoya las obras que hacen falta en tu barrio de ${nombreCiudad}.`,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#faf6ef',
    theme_color: portada?.portal?.color_marca ?? '#0d7d6c',
    lang: 'es-EC',
    categories: ['government', 'social'],
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
