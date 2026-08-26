'use client';

import { useRef, useState } from 'react';

import { ArrowRight, Camera, Film, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { subirMediaDeAvance } from '@/modules/obras/services/subida.service';
import { cifra, cn } from '@/shared/lib/utils';

import { useCambiarEstado } from '../hooks/use-panel';
import type { ColumnaTablero, TarjetaTablero } from '../services/panel.service';

interface Props {
  ciudadId: string;
  obra: TarjetaTablero;
  desde: ColumnaTablero;
  hacia: ColumnaTablero;
  onCerrar: () => void;
}

/**
 * Lo que se abre al soltar una tarjeta en otra columna. Aquí ocurre el momento
 * de valor del producto: el candidato escribe dos líneas, graba un video de
 * treinta segundos, y eso le llega por WhatsApp a las personas exactas que
 * pidieron esa obra. Antes de enviar se ve a cuántas y cuánto cuesta.
 */
export function HojaCambioEstado({ ciudadId, obra, desde, hacia, onCerrar }: Props) {
  const [texto, setTexto] = useState('');
  const [media, setMedia] = useState<{ tipo: string; url: string; nombre: string }[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [notificar, setNotificar] = useState(hacia.notifica);

  const camara = useRef<HTMLInputElement>(null);
  const fotos = useRef<HTMLInputElement>(null);
  const cambiar = useCambiarEstado(ciudadId);

  const destinatarios = notificar ? obra.apoyos : 0;
  const costo = (destinatarios * 0.008).toFixed(2);

  async function agregar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    e.target.value = '';

    setSubiendo(true);
    try {
      for (const archivo of archivos.slice(0, 6)) {
        const subido = await subirMediaDeAvance(ciudadId, archivo);
        setMedia((m) => [...m, { ...subido, nombre: archivo.name }]);
      }
    } catch {
      toast.error('No pudimos subir uno de los archivos.');
    } finally {
      setSubiendo(false);
    }
  }

  async function publicar() {
    const respuesta = await cambiar.mutateAsync({
      obraId: obra.id,
      estadoId: hacia.id,
      texto,
      media: media.map(({ tipo, url }) => ({ tipo, url })),
      notificar,
    });
    if (respuesta.success) onCerrar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCerrar}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="bg-crema relative flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl p-5 sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
              Cambio de estado
            </span>
            <Titulo nivel="h3">{obra.titulo}</Titulo>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-fg-muted hover:text-fg-default -mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[0.8125rem]">
          <span
            className="rounded-full px-2.5 py-1 font-semibold"
            style={{ backgroundColor: `${desde.color}1a`, color: desde.color }}
          >
            {desde.nombre}
          </span>
          <ArrowRight className="text-fg-faint size-4" />
          <span
            className="rounded-full px-2.5 py-1 font-bold"
            style={{ backgroundColor: `${hacia.color}22`, color: hacia.color }}
          >
            {hacia.nombre}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="mensaje" className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
            Mensaje para los vecinos
          </label>
          <textarea
            id="mensaje"
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, 300))}
            placeholder={hacia.descripcion || 'Cuéntales en dos líneas qué pasó con esta obra.'}
            className="border-linea focus:border-teal focus:ring-teal/20 w-full resize-none rounded-xl border bg-white px-4 py-3 text-[0.9375rem] outline-none transition-all focus:ring-3"
          />
          <Texto tamano="xs" tono="tenue" className="cifra self-end">
            {texto.length}/300
          </Texto>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
            Adjuntar (opcional)
          </span>

          {media.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {media.map((m, i) => (
                <div key={i} className="relative">
                  {m.tipo === 'video' ? (
                    <div className="flex aspect-square items-center justify-center rounded-lg bg-black/80">
                      <Film className="size-5 text-white/80" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Quitar"
                    className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* `capture` con accept de video abre la cámara para grabar: el
              candidato responde con su cara sin salir del panel. */}
          <input ref={camara} type="file" accept="video/*" capture="user" onChange={agregar} className="hidden" />
          <input ref={fotos} type="file" accept="image/*,video/*" multiple onChange={agregar} className="hidden" />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="lg"
              disabled={subiendo}
              onClick={() => camara.current?.click()}
              className="flex-1"
            >
              {subiendo ? <Loader2 className="animate-spin" /> : <Camera />}
              Grabar respuesta
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={subiendo}
              onClick={() => fotos.current?.click()}
              className="flex-1"
            >
              <Film />
              Subir archivos
            </Button>
          </div>
        </div>

        <label
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-colors',
            notificar ? 'bg-teal-pastel' : 'bg-crema-2',
          )}
        >
          <input
            type="checkbox"
            checked={notificar}
            onChange={(e) => setNotificar(e.target.checked)}
            className="accent-teal mt-0.5 size-4"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-fg-strong flex items-center gap-1.5 text-[0.875rem] font-semibold">
              <MessageCircle className="size-3.5" />
              Avisar por WhatsApp
            </span>
            <Texto tamano="xs">
              {destinatarios > 0
                ? `Se enviará a ${cifra(destinatarios)} ${destinatarios === 1 ? 'vecino que apoyó' : 'vecinos que apoyaron'} esta obra. Costo estimado: $${costo}`
                : 'Nadie apoya esta obra todavía, así que no se enviará nada.'}
            </Texto>
          </div>
        </label>

        <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
          <Button variant="outline" size="lg" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variant="accion"
            size="lg"
            disabled={cambiar.isPending || subiendo}
            onClick={() => void publicar()}
            className="flex-1"
          >
            {cambiar.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            {notificar && destinatarios > 0 ? 'Publicar y avisar' : 'Publicar'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
