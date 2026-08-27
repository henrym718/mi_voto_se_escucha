import type { Metadata } from 'next';

import { type PerfilResumen, PerfilesView } from '@/modules/portada/views/perfiles.view';
import { ciudadActual } from '@/shared/config/ciudad';
import { supabaseServidor } from '@/shared/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Quién está detrás',
  description: 'Conoce al candidato y a su equipo, y dónde encontrarlos.',
};

export default async function PaginaPerfiles() {
  const slug = await ciudadActual();
  const supabase = await supabaseServidor();

  // En el servidor y no con un hook: es la página que alguien abre antes de
  // dar su número, así que tiene que llegar con las caras ya pintadas.
  const { data } = await supabase.rpc('portal_perfiles', { p_ciudad_slug: slug });
  const respuesta = data as unknown as { success: boolean; items?: PerfilResumen[] } | null;

  return <PerfilesView items={respuesta?.items ?? []} />;
}
