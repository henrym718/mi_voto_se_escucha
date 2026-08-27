'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
  BarChart3,
  Columns3,
  Inbox,
  LayoutTemplate,
  LogOut,
  MapPin,
  Menu,
  Send,
  Settings2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Texto } from '@/components/typography';
import { cerrarSesion } from '@/modules/identidad/services/identidad.service';
import { RUTAS } from '@/shared/config/rutas';
import { cn } from '@/shared/lib/utils';

import { usePanel } from '../panel.provider';

interface Enlace {
  href: string;
  etiqueta: string;
  Icono: LucideIcon;
  /** Si es true, solo lo ven quienes pueden escribir. */
  soloEditores?: boolean;
}

const GRUPOS: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: 'Demanda',
    enlaces: [
      { href: RUTAS.panel.tablero, etiqueta: 'Tablero de obras', Icono: Columns3 },
      { href: RUTAS.panel.cola, etiqueta: 'Pedidos por revisar', Icono: Inbox, soloEditores: true },
      { href: RUTAS.panel.ranking, etiqueta: 'Ranking por barrio', Icono: BarChart3 },
    ],
  },
  {
    titulo: 'Campaña',
    enlaces: [
      { href: RUTAS.panel.contenido, etiqueta: 'Portada y perfiles', Icono: LayoutTemplate },
      { href: RUTAS.panel.canales, etiqueta: 'Canales de WhatsApp', Icono: Send, soloEditores: true },
      { href: RUTAS.panel.estados, etiqueta: 'Estados', Icono: Settings2, soloEditores: true },
      // Sin soloEditores: el candidato no la puede guardar, pero mirar qué
      // sectores tiene su cantón es justo lo que va a querer hacer.
      { href: RUTAS.panel.catalogo, etiqueta: 'Sectores y categorías', Icono: MapPin },
    ],
  },
];

const NOMBRE_ROL = {
  admin: 'Administrador',
  editor: 'Editor',
  candidato: 'Solo lectura',
} as const;

export function BarraPanel() {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();
  const router = useRouter();
  const { ciudad, admin, puedeEditar } = usePanel();

  const grupos = GRUPOS.map((g) => ({
    ...g,
    enlaces: g.enlaces.filter((e) => !e.soloEditores || puedeEditar),
  })).filter((g) => g.enlaces.length > 0);

  const contenido = (
    <>
      <div className="flex flex-col px-5 pt-5 pb-4">
        <span className="text-fg-strong text-[0.9375rem] leading-tight font-extrabold tracking-[-0.02em]">
          Mi Voto Se Escucha
        </span>
        <span className="text-teal text-[0.7rem] font-bold tracking-[0.14em] uppercase">
          {ciudad.nombre}
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-5 px-3">
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="flex flex-col gap-1">
            <span className="text-fg-faint px-2 pb-1 text-[0.65rem] font-bold tracking-[0.14em] uppercase">
              {grupo.titulo}
            </span>
            {grupo.enlaces.map(({ href, etiqueta, Icono }) => {
              const activo = ruta === href || ruta.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setAbierto(false)}
                  className={cn(
                    'relative flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[0.875rem] font-medium transition-colors',
                    activo ? 'text-teal-hondo' : 'text-fg-muted hover:text-fg-default hover:bg-crema-2',
                  )}
                >
                  {activo && (
                    <motion.span
                      layoutId="panel-activo"
                      className="bg-teal-pastel absolute inset-0 rounded-xl"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icono className="relative size-[18px] shrink-0" />
                  <span className="relative">{etiqueta}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-linea mt-auto flex flex-col gap-2 border-t px-5 py-4">
        <div className="flex flex-col">
          <span className="text-fg-default truncate text-[0.8125rem] font-semibold">
            {admin.nombre || 'Equipo'}
          </span>
          <Texto tamano="xs" tono="tenue">
            {NOMBRE_ROL[admin.rol]}
          </Texto>
        </div>
        <button
          type="button"
          onClick={async () => {
            await cerrarSesion();
            router.push(RUTAS.publico.inicio);
            router.refresh();
          }}
          className="text-fg-muted hover:text-fg-default flex items-center gap-2 text-[0.8125rem] font-medium transition-colors"
        >
          <LogOut className="size-4" />
          Salir
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Móvil: cabecera con hamburguesa */}
      <header className="border-linea sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-white px-4 md:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          className="text-fg-default -ml-2 flex size-10 items-center justify-center rounded-xl"
        >
          <Menu className="size-5" />
        </button>
        <span className="text-fg-strong text-[0.9375rem] font-bold">{ciudad.nombre}</span>
      </header>

      <AnimatePresence>
        {abierto && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAbierto(false)}
              className="fixed inset-0 z-50 bg-black/40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col bg-white md:hidden"
            >
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="text-fg-muted absolute top-4 right-4 flex size-9 items-center justify-center rounded-full"
              >
                <X className="size-5" />
              </button>
              {contenido}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Escritorio: barra fija */}
      <aside className="border-linea hidden h-dvh w-64 shrink-0 flex-col border-r bg-white md:sticky md:top-0 md:flex">
        {contenido}
      </aside>
    </>
  );
}
