'use client';

import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronLeft, Loader2, MessageCircle } from 'lucide-react';

import { Titulo, Texto } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { normalizarTelefono, telefonoLegible } from '@/shared/lib/utils';

import { SEGUNDOS_PARA_REENVIAR } from '../services/identidad.service';
import { useCuentaRegresiva, usePedirCodigo, useVerificarCodigo } from '../hooks/use-identidad';

interface Ciudadela {
  id: string;
  nombre: string;
  zona: string;
}

interface Props {
  abierta: boolean;
  onCerrar: () => void;
  onListo: () => void;
  ciudadSlug: string;
  ciudadelas: Ciudadela[];
  /** Qué estaba intentando hacer, para que la hoja lo diga en su título. */
  motivo?: 'apoyar' | 'publicar' | 'general';
  origen?: 'directo' | 'qr' | 'compartido';
}

const TITULOS = {
  apoyar: 'Confirma tu número para apoyar',
  publicar: 'Confirma tu número para publicar',
  general: 'Confirma tu número',
} as const;

/**
 * La verificación aparece como hoja sobre lo que el vecino estaba mirando, no
 * como página aparte: nunca pierde de vista la obra que quería apoyar, y al
 * terminar sigue justo donde estaba.
 */
export function HojaVerificacion({
  abierta,
  onCerrar,
  onListo,
  ciudadSlug,
  ciudadelas,
  motivo = 'general',
  origen = 'directo',
}: Props) {
  const [paso, setPaso] = useState<'telefono' | 'codigo' | 'ciudadela'>('telefono');
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState('');
  const [espera, setEspera] = useCuentaRegresiva(0);
  const campoCodigo = useRef<HTMLInputElement>(null);

  const pedir = usePedirCodigo();
  const verificar = useVerificarCodigo();

  const e164 = normalizarTelefono(telefono);
  const telefonoValido = Boolean(e164);

  useEffect(() => {
    if (paso === 'codigo') setTimeout(() => campoCodigo.current?.focus(), 250);
  }, [paso]);

  // El reinicio va aquí y no en un efecto: cerrar la hoja es un evento del
  // usuario, no una consecuencia de que cambie el estado.
  function cerrar() {
    setPaso('telefono');
    setCodigo('');
    onCerrar();
  }

  async function enviarCodigo() {
    if (!e164) return;
    await pedir.mutateAsync(e164);
    setEspera(SEGUNDOS_PARA_REENVIAR);
    setPaso('codigo');
  }

  async function confirmar(codigoFinal: string) {
    if (!e164 || codigoFinal.length < 6) return;
    const vecino = await verificar.mutateAsync({
      telefono: e164,
      codigo: codigoFinal,
      ciudadSlug,
      origen,
    });
    if (vecino.necesita_ciudadela) {
      setPaso('ciudadela');
      return;
    }
    onListo();
  }

  return (
    <Drawer open={abierta} onOpenChange={(v) => !v && cerrar()}>
      <DrawerContent className="bg-crema border-linea max-h-[92vh]">
        <DrawerTitle className="sr-only">{TITULOS[motivo]}</DrawerTitle>

        <div className="mx-auto w-full max-w-md px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <AnimatePresence mode="wait" initial={false}>
            {paso === 'telefono' && (
              <motion.div
                key="telefono"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1.5">
                  <Titulo nivel="h2">{TITULOS[motivo]}</Titulo>
                  <Texto tamano="sm">
                    Lo usamos solo para saber que eres una persona real de la zona y avisarte
                    cuando tu obra avance. No hay contraseñas ni correos.
                  </Texto>
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="telefono"
                    className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase"
                  >
                    Tu celular
                  </label>
                  <div className="flex gap-2">
                    <div className="border-linea flex h-14 items-center rounded-xl border bg-white px-4">
                      <span className="text-fg-default text-base font-semibold">+593</span>
                    </div>
                    <input
                      id="telefono"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="099 123 4567"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && telefonoValido && void enviarCodigo()}
                      className="border-linea focus:border-teal focus:ring-teal/20 h-14 flex-1 rounded-xl border bg-white px-4 text-base font-semibold outline-none transition-all focus:ring-3"
                    />
                  </div>
                  {telefono.length > 3 && !telefonoValido && (
                    <Texto tamano="xs" tono="marca" className="text-peligro">
                      Escribe un celular ecuatoriano, como 0991234567.
                    </Texto>
                  )}
                </div>

                <Button
                  size="xl"
                  variant="institucional"
                  disabled={!telefonoValido || pedir.isPending}
                  onClick={() => void enviarCodigo()}
                  className="w-full"
                >
                  {pedir.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <MessageCircle className="size-5" />
                  )}
                  Enviarme el código por WhatsApp
                </Button>
              </motion.div>
            )}

            {paso === 'codigo' && (
              <motion.div
                key="codigo"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-5"
              >
                <button
                  type="button"
                  onClick={() => setPaso('telefono')}
                  className="text-fg-muted hover:text-fg-default -ml-1 flex w-fit items-center gap-1 text-sm font-medium transition-colors"
                >
                  <ChevronLeft className="size-4" />
                  Cambiar número
                </button>

                <div className="flex flex-col gap-1.5">
                  <Titulo nivel="h2">Escribe el código</Titulo>
                  <Texto tamano="sm">
                    Te llegó por WhatsApp al {telefonoLegible(e164 ?? '')}.
                  </Texto>
                </div>

                <input
                  ref={campoCodigo}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="······"
                  value={codigo}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCodigo(v);
                    // Seis dígitos y se envía solo: nadie debería tener que
                    // buscar el botón después de teclear el último número.
                    if (v.length === 6) void confirmar(v);
                  }}
                  className="border-linea focus:border-teal focus:ring-teal/20 cifra h-20 w-full rounded-2xl border bg-white text-center text-[2rem] font-extrabold tracking-[0.4em] outline-none transition-all focus:ring-3"
                />

                <Button
                  size="xl"
                  variant="institucional"
                  disabled={codigo.length < 6 || verificar.isPending}
                  onClick={() => void confirmar(codigo)}
                  className="w-full"
                >
                  {verificar.isPending ? <Loader2 className="animate-spin" /> : <Check className="size-5" />}
                  Confirmar
                </Button>

                <button
                  type="button"
                  disabled={espera > 0 || pedir.isPending}
                  onClick={() => void enviarCodigo()}
                  className="text-fg-subtle hover:text-fg-default disabled:hover:text-fg-subtle text-center text-sm transition-colors disabled:cursor-default"
                >
                  {espera > 0 ? `Reenviar en ${espera}s` : 'No me llegó, reenviar'}
                </button>
              </motion.div>
            )}

            {paso === 'ciudadela' && (
              <motion.div
                key="ciudadela"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="flex min-h-0 flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Titulo nivel="h2">¿En qué ciudadela vives?</Titulo>
                  <Texto tamano="sm">
                    Con esto sabemos qué obras te tocan de cerca. Solo puedes apoyar las de tu
                    propia ciudadela, y por eso el resultado vale.
                  </Texto>
                </div>
                <ListaCiudadelas
                  ciudadelas={ciudadelas}
                  onElegir={async (id) => {
                    await verificar.mutateAsync({
                      telefono: e164!,
                      codigo,
                      ciudadSlug,
                      ciudadelaId: id,
                      origen,
                    });
                    onListo();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <Texto tamano="xs" tono="tenue" className="mt-4 text-center">
            Al continuar aceptas recibir avisos de tus obras por WhatsApp. Puedes darte de baja
            cuando quieras.
          </Texto>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ListaCiudadelas({
  ciudadelas,
  onElegir,
}: {
  ciudadelas: Ciudadela[];
  onElegir: (id: string) => void | Promise<void>;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [eligiendo, setEligiendo] = useState<string | null>(null);

  const filtradas = busqueda.trim()
    ? ciudadelas.filter((c) => c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : ciudadelas;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <input
        type="search"
        placeholder="Busca tu ciudadela…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="border-linea focus:border-teal focus:ring-teal/20 h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition-all focus:ring-3"
      />
      <div className="-mx-1 max-h-[45vh] overflow-y-auto px-1">
        <div className="flex flex-col gap-1.5 pb-2">
          {filtradas.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={eligiendo !== null}
              onClick={async () => {
                setEligiendo(c.id);
                try {
                  await onElegir(c.id);
                } finally {
                  setEligiendo(null);
                }
              }}
              className="border-linea hover:border-teal hover:bg-teal-pastel/40 flex min-h-12 items-center justify-between rounded-xl border bg-white px-4 py-3 text-left transition-all active:scale-[0.99] disabled:opacity-60"
            >
              <span className="text-fg-default text-[0.9375rem] font-medium">{c.nombre}</span>
              {eligiendo === c.id && <Loader2 className="text-teal size-4 animate-spin" />}
            </button>
          ))}
          {filtradas.length === 0 && (
            <Texto tamano="sm" className="py-6 text-center">
              No encontramos esa ciudadela. Prueba con otro nombre.
            </Texto>
          )}
        </div>
      </div>
    </div>
  );
}
