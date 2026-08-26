import { redirect } from 'next/navigation';

import { BarraPanel } from '@/modules/panel/components/barra-panel';
import { PanelProvider } from '@/modules/panel/panel.provider';
import { ciudadActual } from '@/shared/config/ciudad';
import { RUTAS } from '@/shared/config/rutas';
import { supabaseServidor } from '@/shared/lib/supabase/server';

/**
 * El guardián vive en el layout, no en cada página: así no hay forma de añadir
 * una pantalla nueva y olvidarse de protegerla.
 */
export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const slug = await ciudadActual();
  const supabase = await supabaseServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(RUTAS.panel.entrar);

  const { data: ciudad } = await supabase
    .from('ciudades')
    .select('id, slug, nombre, modo')
    .eq('slug', slug)
    .single();

  if (!ciudad) redirect(RUTAS.publico.inicio);

  const { data: admin } = await supabase
    .from('admins')
    .select('id, rol, nombre, activo')
    .eq('id', user.id)
    .eq('ciudad_id', ciudad.id)
    .maybeSingle();

  // Un vecino con sesión que escribe /panel a mano no ve el panel ni un error
  // revelador: vuelve al inicio como si la ruta no existiera.
  if (!admin || !admin.activo) redirect(RUTAS.publico.inicio);

  const puedeEditar = admin.rol === 'admin' || admin.rol === 'editor';

  return (
    <PanelProvider
      ciudad={ciudad}
      admin={{ id: admin.id, rol: admin.rol as 'admin' | 'editor' | 'candidato', nombre: admin.nombre }}
      puedeEditar={puedeEditar}
    >
      <div className="bg-crema flex min-h-dvh flex-col md:flex-row">
        <BarraPanel />
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
    </PanelProvider>
  );
}
