'use client';

import { TableroView } from '@/modules/panel/views/tablero.view';
import { usePanel } from '@/modules/panel/panel.provider';

export default function PaginaTablero() {
  const { ciudad, puedeEditar } = usePanel();
  return <TableroView ciudadId={ciudad.id} puedeEditar={puedeEditar} />;
}
