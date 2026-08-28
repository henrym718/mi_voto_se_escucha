import type { Metadata } from 'next';

import { MisPropuestasView } from '@/modules/obras/views/mis-propuestas.view';

export const metadata: Metadata = {
  title: 'Mis propuestas',
  description: 'Lo que has pedido para tu barrio y en qué va cada cosa.',
  // Es la lista privada de una persona: no tiene sentido en un buscador y
  // tampoco se puede indexar, porque sin su sesión sale vacía.
  robots: { index: false, follow: false },
};

export default function PaginaMisPropuestas() {
  return <MisPropuestasView />;
}
