import type { Metadata } from 'next';

import { DifusionView } from '@/modules/panel/views/difusion.view';

export const metadata: Metadata = { title: 'Difusión' };

export default function PaginaDifusion() {
  return <DifusionView />;
}
