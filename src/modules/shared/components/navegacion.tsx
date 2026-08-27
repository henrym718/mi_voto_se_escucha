'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Home, ListOrdered, Plus, Users } from 'lucide-react';
import { motion } from 'motion/react';

import { RUTAS } from '@/shared/config/rutas';
import { cn } from '@/shared/lib/utils';

const ENLACES = [
  { href: RUTAS.publico.inicio, etiqueta: 'Inicio', Icono: Home },
  { href: RUTAS.publico.obras, etiqueta: 'Obras', Icono: ListOrdered },
  { href: RUTAS.publico.perfiles, etiqueta: 'Perfiles', Icono: Users },
] as const;

/**
 * En móvil va abajo, al alcance del pulgar. En pantallas grandes se convierte
 * en barra superior: la misma información, colocada donde cada dispositivo la
 * espera, sin duplicar componentes.
 */
export function Navegacion() {
  const ruta = usePathname();

  return (
    <>
      {/* Barra superior — tablet y escritorio */}
      <header className="border-linea sticky top-0 z-40 hidden border-b bg-white/85 backdrop-blur-md md:block">
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-1 px-6">
          <Link href={RUTAS.publico.inicio} className="mr-4 flex flex-col leading-none">
            <span className="text-fg-strong text-[0.9375rem] font-extrabold tracking-[-0.02em]">
              Mi Voto Se Escucha
            </span>
          </Link>
          {ENLACES.map(({ href, etiqueta }) => {
            const activo = href === '/' ? ruta === '/' : ruta.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  activo ? 'text-fg-strong font-semibold' : 'text-fg-muted hover:text-fg-strong',
                )}
              >
                {activo && (
                  <motion.span
                    layoutId="nav-activo-desktop"
                    className="bg-crema-2 absolute inset-0 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{etiqueta}</span>
              </Link>
            );
          })}
          <Link
            href={RUTAS.publico.publicar}
            className="bg-tinta hover:bg-tinta-2 ml-auto flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition-colors active:translate-y-px"
          >
            <Plus className="size-4" />
            Publicar problema
          </Link>
        </nav>
      </header>

      {/* Barra inferior — móvil */}
      <nav className="border-linea fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur-md md:hidden">
        <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
          {ENLACES.map(({ href, etiqueta, Icono }) => {
            const activo = href === '/' ? ruta === '/' : ruta.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={activo ? 'page' : undefined}
                className="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2"
              >
                {activo && (
                  <motion.span
                    layoutId="nav-activo-movil"
                    className="bg-tinta absolute top-0 h-0.5 w-10 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <Icono
                  className={cn(
                    'size-5 transition-colors',
                    activo ? 'text-fg-strong' : 'text-fg-subtle',
                  )}
                  strokeWidth={activo ? 2.3 : 2}
                />
                <span
                  className={cn(
                    'text-[0.6875rem] transition-colors',
                    activo ? 'text-fg-strong font-bold' : 'text-fg-subtle',
                  )}
                >
                  {etiqueta}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
