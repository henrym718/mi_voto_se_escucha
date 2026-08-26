import type { Metadata } from 'next';

import { EstadosView } from '@/modules/panel/views/estados.view';

export const metadata: Metadata = { title: 'Estados' };

export default function PaginaEstados() {
  return <EstadosView />;
}
