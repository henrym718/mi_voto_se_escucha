import type { Metadata } from 'next';

import { ContenidoView } from '@/modules/panel/views/contenido.view';

export const metadata: Metadata = { title: 'Portada y perfiles' };

export default function PaginaContenido() {
  return <ContenidoView />;
}
