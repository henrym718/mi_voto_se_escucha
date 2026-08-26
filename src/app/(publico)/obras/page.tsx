import type { Metadata } from 'next';

import { ObrasView } from '@/modules/obras/views/obras.view';

export const metadata: Metadata = {
  title: 'Obras pedidas',
  description: 'Mira lo que están pidiendo los vecinos de cada ciudadela y apoya lo tuyo.',
};

export default function PaginaObras() {
  return <ObrasView />;
}
