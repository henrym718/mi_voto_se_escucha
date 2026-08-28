import type { Metadata } from 'next';

import { DifusionView } from '@/modules/panel/views/difusion.view';

export const metadata: Metadata = { title: 'QR para carteles' };

export default function PaginaDifusion() {
  return <DifusionView />;
}
