'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Plus } from 'lucide-react';

import { RUTAS } from '@/shared/config/rutas';

/**
 * El botón flotante permanente. Está en todas las páginas públicas y siempre en
 * el mismo sitio: reportar un problema nunca puede depender de encontrar el
 * menú. Se esconde solo en la propia pantalla de publicar, donde sobraría.
 */
export function BotonPublicar() {
  const ruta = usePathname();
  if (ruta.startsWith(RUTAS.publico.publicar)) return null;

  return (
    <Link
      href={RUTAS.publico.publicar}
      className="bg-tinta hover:bg-tinta-2 fixed right-4 bottom-20 z-30 flex min-h-14 items-center gap-2 rounded-full px-5 text-[0.9375rem] font-bold text-white shadow-lg transition-colors active:translate-y-px md:bottom-8"
    >
      <Plus className="size-5" strokeWidth={2.6} />
      Publicar problema
    </Link>
  );
}
