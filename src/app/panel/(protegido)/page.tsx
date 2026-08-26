import { redirect } from 'next/navigation';

import { RUTAS } from '@/shared/config/rutas';

export default function PaginaPanel() {
  redirect(RUTAS.panel.tablero);
}
