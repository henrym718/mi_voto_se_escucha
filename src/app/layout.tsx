import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { Toaster } from '@/components/ui/sonner';
import { ciudadActual } from '@/shared/config/ciudad';
import { supabaseServidor } from '@/shared/lib/supabase/server';
import { QueryProvider } from '@/shared/providers/query.provider';

import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const slug = await ciudadActual();
  const supabase = await supabaseServidor();
  const { data } = await supabase.rpc('ciudad_portada', { p_ciudad_slug: slug });
  const portada = data as { ciudad?: { nombre?: string }; portal?: { eslogan?: string } } | null;

  const nombreCiudad = portada?.ciudad?.nombre ?? 'tu ciudad';
  const titulo = `Mi Voto Se Escucha · ${nombreCiudad}`;
  const descripcion =
    portada?.portal?.eslogan ||
    `Pide la obra que hace falta en tu barrio de ${nombreCiudad} y apoya las de tus vecinos. Las más votadas entran al plan de obras.`;

  return {
    title: { default: titulo, template: `%s · Mi Voto Se Escucha` },
    description: descripcion,
    applicationName: 'Mi Voto Se Escucha',
    // Sin esto el enlace que se comparte al grupo del barrio llega como texto
    // pelado, y ese enlace es el motor de adquisición de todo el producto.
    openGraph: {
      type: 'website',
      locale: 'es_EC',
      siteName: titulo,
      title: titulo,
      description: descripcion,
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#0d7d6c',
  width: 'device-width',
  initialScale: 1,
  // Se deja hacer zoom: mucha gente mayor lo necesita para leer.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const slug = await ciudadActual();
  const supabase = await supabaseServidor();
  const { data } = await supabase.rpc('ciudad_portada', { p_ciudad_slug: slug });
  const portada = data as { portal?: { color_marca?: string } } | null;
  const colorMarca = portada?.portal?.color_marca ?? '#0d7d6c';

  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased`}
        // El color del cliente entra como variable, no recompilado: cambiarlo
        // desde el panel repinta la marca sin volver a desplegar.
        style={{ '--color-marca': colorMarca } as React.CSSProperties}
      >
        <QueryProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </QueryProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
