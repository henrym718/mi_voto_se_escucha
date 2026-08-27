import type { Metadata } from 'next';

import { CatalogoView } from '@/modules/panel/views/catalogo.view';

export const metadata: Metadata = { title: 'Catálogo' };

export default function PaginaCatalogo() {
  return <CatalogoView />;
}
