import type { Metadata } from 'next';

import { EquipoView } from '@/modules/portada/views/equipo.view';

export const metadata: Metadata = {
  title: 'Quién está detrás',
  description: 'Conoce al candidato, su propuesta y dónde encontrarlo.',
};

export default function PaginaEquipo() {
  return <EquipoView />;
}
