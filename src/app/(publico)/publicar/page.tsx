import type { Metadata } from 'next';

import { PublicarView } from '@/modules/obras/views/publicar.view';

export const metadata: Metadata = {
  title: 'Publicar mi pedido',
  description: 'Cuéntanos qué le hace falta a tu barrio. Si alguien ya lo pidió, apóyalo.',
};

export default function PaginaPublicar() {
  return <PublicarView />;
}
