'use client';

import { useState } from 'react';

import { Check, MapPin, Search } from 'lucide-react';
import { motion } from 'motion/react';

import { Texto } from '@/components/typography';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, coincide } from '@/shared/lib/utils';

interface Ciudadela {
  id: string;
  nombre: string;
  verificado: boolean;
}

/**
 * El buscador de sectores vive en un modal para no comerse la portada: la
 * lista completa de ciudadelas puede pasar de cien y desplegarla en la página
 * la volvía interminable. Aquí se busca, se toca y se vuelve.
 */
export function SelectorSector({
  abierto,
  onCerrar,
  ciudadelas,
  elegida,
  nombreCiudad,
  onElegir,
}: {
  abierto: boolean;
  onCerrar: () => void;
  ciudadelas: Ciudadela[];
  elegida: string | null;
  nombreCiudad: string;
  onElegir: (id: string | null) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const filtradas = ciudadelas.filter((c) => coincide(c.nombre, busqueda));

  const elegir = (id: string | null) => {
    onElegir(id);
    setBusqueda('');
    onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[85dvh] gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
        <DialogHeader className="gap-1 px-5 pt-5 pb-3 text-left">
          <DialogTitle className="text-fg-strong text-[1.25rem] font-bold tracking-[-0.02em]">
            ¿De qué sector eres?
          </DialogTitle>
          <DialogDescription className="text-fg-muted text-[0.875rem]">
            Elige tu ciudadela para ver lo que piden tus vecinos. No hace falta registrarse para
            mirar.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="border-linea focus-within:border-tinta flex h-12 items-center gap-2.5 rounded-full border-2 bg-white px-4 transition-all">
            <Search className="text-fg-subtle size-[18px] shrink-0" />
            <input
              type="search"
              autoFocus
              placeholder="Busca tu ciudadela…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col overflow-y-auto px-3 pb-4" style={{ maxHeight: '50dvh' }}>
          <button
            type="button"
            onClick={() => elegir(null)}
            className={cn(
              'flex min-h-12 items-center gap-3 rounded-2xl px-3 text-left transition-colors',
              elegida === null ? 'bg-crema-2' : 'hover:bg-crema-2',
            )}
          >
            <span className="bg-tinta flex size-8 shrink-0 items-center justify-center rounded-full">
              <MapPin className="size-4 text-white" />
            </span>
            <span className="text-fg-strong flex-1 text-[0.9375rem] font-semibold">
              Toda la ciudad · {nombreCiudad}
            </span>
            {elegida === null && <Check className="text-fg-strong size-5 shrink-0" />}
          </button>

          {filtradas.map((c, i) => (
            <motion.button
              key={c.id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(i, 12) * 0.015 }}
              onClick={() => elegir(c.id)}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-2xl px-3 text-left transition-colors',
                elegida === c.id ? 'bg-crema-2' : 'hover:bg-crema-2',
              )}
            >
              <span className="bg-crema-2 text-fg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
                <MapPin className="size-4" />
              </span>
              <span className="text-fg-strong flex-1 truncate text-[0.9375rem] font-medium">
                {c.nombre}
              </span>
              {elegida === c.id && <Check className="text-fg-strong size-5 shrink-0" />}
            </motion.button>
          ))}

          {filtradas.length === 0 && (
            <div className="flex flex-col items-center gap-1 px-6 py-8 text-center">
              <Texto peso="fuerte" tono="normal">
                No encontramos esa ciudadela.
              </Texto>
              <Texto tamano="sm">Revisa cómo la escribiste o mira toda la ciudad.</Texto>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
