'use client';

import { useState } from 'react';

import { Check, Loader2, MessageCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Texto } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { cn, coincide, normalizarTelefono } from '@/shared/lib/utils';

import { useGuardarContacto } from '../hooks/use-identidad';

interface Ciudadela {
  id: string;
  nombre: string;
}

interface Props {
  abierta: boolean;
  onCerrar: () => void;
  /** Se llama cuando el número quedó guardado; sigue lo que el vecino iba a hacer. */
  onListo: () => void;
  ciudadSlug: string;
  ciudadelas: Ciudadela[];
  /** Sector que ya traía puesto en el filtro. Si viene, no se pregunta. */
  sectorSugerido?: string | null;
  motivo?: 'apoyar' | 'publicar';
  origen?: 'directo' | 'qr' | 'compartido';
}

/**
 * El único formulario de toda la parte pública, y aparece una sola vez en la
 * vida del vecino: un campo de teléfono.
 *
 * No verifica nada y no bloquea nada. Su trabajo es capturar el contacto en el
 * instante de máxima intención —el vecino ya tocó Apoyar— sin que eso le cueste
 * el gesto que venía a hacer. Por eso se puede saltar: perder un número es
 * mucho más barato que perder un apoyo.
 */
export function HojaContacto({
  abierta,
  onCerrar,
  onListo,
  ciudadSlug,
  ciudadelas,
  sectorSugerido = null,
  motivo = 'apoyar',
  origen = 'directo',
}: Props) {
  const [telefono, setTelefono] = useState('');
  // `undefined` = el vecino no ha tocado el sector, así que manda el del filtro,
  // que puede llegar después de abrir la hoja. `null` = lo abrió para cambiarlo.
  // Derivarlo así evita un efecto que copie props a estado y se desincronice.
  const [sectorTocado, setSectorTocado] = useState<string | null | undefined>(undefined);
  const [busqueda, setBusqueda] = useState('');
  const [canal, setCanal] = useState(true);

  const guardar = useGuardarContacto();

  const sector = sectorTocado === undefined ? sectorSugerido : sectorTocado;
  const e164 = normalizarTelefono(telefono);
  const listo = Boolean(e164) && Boolean(sector);
  const filtradas = ciudadelas.filter((c) => coincide(c.nombre, busqueda)).slice(0, 40);

  async function enviar() {
    if (!e164 || !sector) return;
    const respuesta = await guardar.mutateAsync({
      ciudadSlug,
      telefono: e164,
      ciudadelaId: sector,
      quiereCanal: canal,
      origen,
    });
    if (respuesta.success) onListo();
  }

  return (
    <Drawer open={abierta} onOpenChange={(v) => !v && onCerrar()}>
      <DrawerContent className="mx-auto max-w-md">
        <div className="flex flex-col gap-4 px-5 pt-2 pb-6">
          <div className="flex flex-col gap-1">
            <DrawerTitle className="text-fg-strong text-[1.375rem] font-bold tracking-[-0.02em]">
              {motivo === 'publicar' ? '¡Recibido! Ya está con el equipo' : '¡Gracias por apoyar!'}
            </DrawerTitle>
            <DrawerDescription className="text-fg-muted text-[0.9375rem]">
              Déjanos tu WhatsApp para avisarte cuando el equipo revise lo de tu sector. Es la única
              vez que te lo pedimos.
            </DrawerDescription>
          </div>

          {/* Sector primero: casi siempre viene resuelto del filtro y este
              bloque ni se despliega. */}
          {sector ? (
            <button
              type="button"
              onClick={() => setSectorTocado(null)}
              className="border-linea flex min-h-12 items-center justify-between gap-3 rounded-2xl border bg-white px-4 text-left"
            >
              <span className="flex flex-col">
                <span className="text-fg-subtle text-[0.6875rem] font-bold tracking-wide uppercase">
                  Tu sector
                </span>
                <span className="text-fg-strong text-[0.9375rem] font-semibold">
                  {ciudadelas.find((c) => c.id === sector)?.nombre ?? 'Elegido'}
                </span>
              </span>
              <span className="text-fg-muted text-[0.8125rem] font-semibold">Cambiar</span>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <Texto tamano="xs" peso="fuerte" tono="normal">
                ¿De qué sector eres?
              </Texto>
              <input
                type="search"
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Busca tu ciudadela…"
                className="border-linea focus:border-tinta h-12 w-full rounded-2xl border-2 bg-white px-4 text-[0.9375rem] outline-none transition-colors"
              />
              <div className="flex max-h-48 flex-col overflow-y-auto">
                {filtradas.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSectorTocado(c.id);
                      setBusqueda('');
                    }}
                    className="hover:bg-crema-2 text-fg-strong flex min-h-11 items-center rounded-xl px-3 text-left text-[0.9375rem] font-medium transition-colors"
                  >
                    {c.nombre}
                  </button>
                ))}
                {filtradas.length === 0 && (
                  <Texto tamano="sm" className="px-3 py-4">
                    No encontramos esa ciudadela. Revisa cómo la escribiste.
                  </Texto>
                )}
              </div>
            </div>
          )}

          {/* El teclado numérico sale solo con inputMode: en un celular de gama
              baja eso ahorra dos toques. */}
          <div className="flex flex-col gap-2">
            <Texto tamano="xs" peso="fuerte" tono="normal">
              Tu WhatsApp
            </Texto>
            <div className="border-linea focus-within:border-tinta flex h-14 items-center gap-2 rounded-2xl border-2 bg-white px-4 transition-colors">
              <span className="text-fg-subtle text-[1rem] font-semibold">🇪🇨 +593</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="099 123 4567"
                className="min-w-0 flex-1 bg-transparent text-[1.0625rem] font-semibold outline-none"
              />
              <AnimatePresence>
                {e164 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Check className="text-exito size-5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCanal((v) => !v)}
            className={cn(
              'flex items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors',
              canal ? 'border-tinta bg-crema-2' : 'border-linea bg-white',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                canal ? 'border-tinta bg-tinta' : 'border-linea',
              )}
            >
              {canal && <Check className="size-3.5 text-white" strokeWidth={3.5} />}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-fg-strong flex items-center gap-1.5 text-[0.9375rem] font-semibold">
                <MessageCircle className="size-4" />
                Súmame al canal de mi sector
              </span>
              <span className="text-fg-muted text-[0.8125rem]">
                Avisos de obras y visitas del equipo. Solo publica el equipo, nadie más escribe.
              </span>
            </span>
          </button>

          <Button
            variant="accion"
            size="xl"
            disabled={!listo || guardar.isPending}
            onClick={enviar}
            className="w-full"
          >
            {guardar.isPending ? <Loader2 className="animate-spin" /> : null}
            Listo
          </Button>

          {/* Saltarse el número no cuesta el apoyo: el voto ya está contado por
              la sesión anónima. Quien no quiere dar su número igual participa. */}
          <button
            type="button"
            onClick={onListo}
            className="text-fg-subtle hover:text-fg-muted min-h-11 text-[0.875rem] font-medium transition-colors"
          >
            Ahora no, gracias
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
