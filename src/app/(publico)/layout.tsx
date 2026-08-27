import { notFound } from 'next/navigation';

import { BotonPublicar } from '@/modules/shared/components/boton-publicar';
import { Navegacion } from '@/modules/shared/components/navegacion';
import { PortalProvider } from '@/modules/shared/portal.provider';
import { ciudadActual } from '@/shared/config/ciudad';
import { supabaseServidor } from '@/shared/lib/supabase/server';

/**
 * Todo lo público cuelga de aquí. La portada se resuelve en el servidor para
 * que el primer pintado llegue con contenido: en una conexión de datos móviles
 * la diferencia entre ver algo al instante y ver una pantalla en blanco es la
 * diferencia entre quedarse y cerrar.
 */
export default async function LayoutPublico({ children }: { children: React.ReactNode }) {
  const slug = await ciudadActual();
  const supabase = await supabaseServidor();
  const { data } = await supabase.rpc('ciudad_portada', { p_ciudad_slug: slug });

  const portada = data as unknown as {
    success: boolean;
    ciudad?: never;
    portal?: never;
    cifras?: never;
  } | null;

  if (!portada?.success || !portada.ciudad) notFound();

  return (
    <PortalProvider
      ciudad={portada.ciudad}
      portal={portada.portal ?? null}
      cifras={portada.cifras ?? { vecinos: 0, obras: 0, apoyos: 0 }}
    >
      <div className="flex min-h-dvh flex-col">
        <Navegacion />
        {/* El padding inferior deja libre la barra de navegación en móvil. */}
        <main className="flex-1 pb-28 md:pb-12">{children}</main>
        <BotonPublicar />
      </div>
    </PortalProvider>
  );
}
