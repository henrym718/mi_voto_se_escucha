import type { Metadata } from 'next';

import { EntrarView } from '@/modules/panel/views/entrar.view';

export const metadata: Metadata = {
  title: 'Entrar al panel',
  robots: { index: false, follow: false },
};

export default function PaginaEntrar() {
  return <EntrarView />;
}
