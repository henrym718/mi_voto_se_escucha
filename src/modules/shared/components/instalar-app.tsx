'use client';

import { useEffect, useState } from 'react';

import { Share, SquarePlus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Texto } from '@/components/typography';
import { Button } from '@/components/ui/button';

const DESCARTADO = 'mvse:instalar-descartado';
const ESPERA_MS = 6000;

/** Lo que Chrome guarda para poder ofrecer la instalación más tarde. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * «Ponla en tu pantalla de inicio».
 *
 * Un ícono en el teléfono es la diferencia entre que el vecino vuelva y que no:
 * nadie se acuerda de una dirección web, pero un ícono al lado de WhatsApp se
 * ve todos los días. La aplicación ya es instalable —el manifest está puesto—
 * pero el navegador esconde esa opción en un menú que nadie abre, así que hay
 * que ofrecerla.
 *
 * Dos caminos, porque los dos sistemas se comportan distinto:
 *
 *   · Android/Chrome dispara `beforeinstallprompt` y deja abrir el diálogo del
 *     sistema desde un botón nuestro. Un toque y queda instalada.
 *   · iOS no tiene ese evento y no lo va a tener: en Safari hay que explicarle
 *     a la persona los dos toques (Compartir → Añadir a inicio). Se detecta el
 *     sistema porque no hay otra forma de saberlo.
 *
 * No aparece si ya está instalada, si la persona lo descartó antes, o en
 * escritorio, donde un ícono en la pantalla de inicio no significa nada.
 */
/** Un solo estado, y siempre desde un temporizador o un manejador: la regla del
 *  compilador de React prohíbe llamar a setState directamente dentro del efecto,
 *  y de paso obliga a que el aviso nazca oculto y aparezca solo cuando toca. */
type Aviso = { modo: 'android'; evento: EventoInstalacion } | { modo: 'ios' } | null;

export function InstalarApp() {
  const [aviso, setAviso] = useState<Aviso>(null);

  useEffect(() => {
    // Ya está instalada: se abrió desde el ícono, no desde el navegador.
    const instalada =
      window.matchMedia('(display-mode: standalone)').matches ||
      // Safari en iOS no implementa display-mode y usa esto en su lugar.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (instalada) return;

    try {
      if (window.localStorage.getItem(DESCARTADO) === '1') return;
    } catch {
      return;
    }

    const ua = window.navigator.userAgent;
    const esIOS = /iPad|iPhone|iPod/.test(ua);
    // Chrome y Firefox en iOS no pueden instalar nada: solo Safari.
    const safariEnIOS = esIOS && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (safariEnIOS) {
      const t = window.setTimeout(() => setAviso({ modo: 'ios' }), ESPERA_MS);
      return () => window.clearTimeout(t);
    }

    let t = 0;
    function alPoder(e: Event) {
      // Sin esto Chrome enseña su propia barra, y salen las dos.
      e.preventDefault();
      const evento = e as EventoInstalacion;
      t = window.setTimeout(() => setAviso({ modo: 'android', evento }), ESPERA_MS);
    }

    window.addEventListener('beforeinstallprompt', alPoder);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', alPoder);
    };
  }, []);

  function descartar() {
    setAviso(null);
    try {
      window.localStorage.setItem(DESCARTADO, '1');
    } catch {
      // Sin almacenamiento volverá a ofrecerlo. Molesta menos que no ofrecerlo.
    }
  }

  async function instalar() {
    if (aviso?.modo !== 'android') return;
    const { evento } = aviso;
    setAviso(null);
    await evento.prompt();
    await evento.userChoice;
    // Aceptada o no, no se vuelve a insistir: quien dijo que no, dijo que no.
    try {
      window.localStorage.setItem(DESCARTADO, '1');
    } catch {
      /* nada que hacer */
    }
  }

  if (!aviso) return null;
  const enIOS = aviso.modo === 'ios';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-3 top-3 z-50 md:hidden"
      >
        <div className="border-tinta flex items-start gap-3 rounded-2xl border bg-white p-3 shadow-lg">
          <span className="bg-tinta flex size-10 shrink-0 items-center justify-center rounded-xl">
            <SquarePlus className="size-5 text-white" />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-col">
              <span className="text-fg-strong text-[0.9375rem] leading-tight font-bold">
                Ponla en tu pantalla de inicio
              </span>
              {enIOS ? (
                <Texto tamano="xs" tono="tenue">
                  Toca <Share className="mb-0.5 inline size-3" /> Compartir y luego «Añadir a
                  pantalla de inicio».
                </Texto>
              ) : (
                <Texto tamano="xs" tono="tenue">
                  Te queda como una aplicación más, sin descargar nada.
                </Texto>
              )}
            </div>

            {!enIOS && (
              <Button size="sm" variant="institucional" onClick={() => void instalar()}>
                Agregar
              </Button>
            )}
          </div>

          <button
            type="button"
            onClick={descartar}
            aria-label="Ahora no"
            className="text-fg-faint hover:text-fg-default flex size-8 shrink-0 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
