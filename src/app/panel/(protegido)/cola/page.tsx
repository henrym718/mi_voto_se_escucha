import type { Metadata } from 'next';

import { ColaView } from '@/modules/panel/views/cola.view';

export const metadata: Metadata = { title: 'Pedidos por revisar' };

export default function PaginaCola() {
  return <ColaView />;
}
