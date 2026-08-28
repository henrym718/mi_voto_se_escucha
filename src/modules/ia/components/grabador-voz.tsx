'use client';

import { useEffect, useRef, useState } from 'react';

import { Loader2, Mic, Square } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';

import { cn } from '@/shared/lib/utils';

/** Dos minutos. Más que eso no es un pedido, es una conversación. */
const SEGUNDOS_MAXIMOS = 120;

interface Props {
  /** Se llama con el audio grabado. El componente no lo transcribe: solo graba. */
  onGrabado: (audio: Blob, segundos: number) => void | Promise<void>;
  /** Mientras el padre sube la nota, el botón se queda ocupado. */
  ocupado?: boolean;
  disabled?: boolean;
}

/**
 * El botón de nota de voz. Mucha gente del cantón escribe con dificultad pero
 * manda audios todo el día por WhatsApp: es el gesto que ya tienen aprendido, y
 * es la diferencia entre que publiquen o no.
 *
 * Se graba tocando una vez y se corta tocando otra — nada de mantener apretado:
 * en un móvil viejo, con la mano ocupada, mantener presionado treinta segundos
 * falla más de lo que parece.
 */
export function GrabadorVoz({ onGrabado, ocupado = false, disabled = false }: Props) {
  const menosMovimiento = useReducedMotion();
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);

  const grabadora = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  // La duración se lleva en una ref además del estado: `onstop` se dispara
  // fuera del render y ahí `segundos` sería el del cierre viejo, no el real.
  const duracion = useRef(0);

  // Soltar el micrófono al desmontar. Sin esto el punto rojo del navegador se
  // queda encendido después de cerrar la hoja, y da la impresión — razonable —
  // de que la aplicación sigue escuchando.
  useEffect(() => {
    return () => {
      grabadora.current?.stream.getTracks().forEach((pista) => pista.stop());
    };
  }, []);

  useEffect(() => {
    if (!grabando) return;
    const reloj = setInterval(() => {
      setSegundos((s) => {
        duracion.current = s + 1;
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(reloj);
  }, [grabando]);

  useEffect(() => {
    if (grabando && segundos >= SEGUNDOS_MAXIMOS) detener();
  }, [segundos, grabando]);

  async function empezar() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Tu navegador no deja grabar audio. Escríbelo y listo.');
      return;
    }

    try {
      const flujo = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      // Safari no acepta webm/opus. Se prueba en orden y se deja que el
      // navegador elija si ninguno le sirve.
      const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(
        (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t),
      );

      const rec = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : undefined);
      trozos.current = [];

      rec.ondataavailable = (evento) => {
        if (evento.data.size > 0) trozos.current.push(evento.data);
      };

      rec.onstop = () => {
        flujo.getTracks().forEach((pista) => pista.stop());
        const audio = new Blob(trozos.current, { type: rec.mimeType || 'audio/webm' });
        if (audio.size > 0) void onGrabado(audio, duracion.current);
      };

      rec.start();
      grabadora.current = rec;
      duracion.current = 0;
      setSegundos(0);
      setGrabando(true);
    } catch {
      toast.error('No pudimos usar el micrófono. Revisa el permiso del navegador.');
    }
  }

  function detener() {
    grabadora.current?.stop();
    grabadora.current = null;
    setGrabando(false);
  }

  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;

  return (
    // La tarjeta ENTERA es el botón, no solo el círculo del micrófono. Antes
    // solo respondía el icono: quien tocaba el texto —que es la mitad de la
    // tarjeta y donde el dedo cae de forma natural— no pasaba nada, y sin
    // saber por qué se ponía a escribir, que es justo lo que esto evita.
    <button
      type="button"
      disabled={disabled || ocupado}
      onClick={() => (grabando ? detener() : void empezar())}
      aria-label={grabando ? 'Detener la grabación' : 'Grabar una nota de voz'}
      className={cn(
        'border-linea hover:border-tinta flex w-full items-center gap-3 rounded-2xl border-2 border-dashed bg-white p-4 text-left transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        grabando && 'border-peligro border-solid',
      )}
    >
      <span
        className={cn(
          'relative flex size-13 shrink-0 items-center justify-center rounded-full transition-all',
          grabando ? 'bg-peligro text-white' : 'bg-tinta text-white',
        )}
      >
        {/* Grabando: el latido rojo, fuerte, que dice que está encendido.
            En reposo: un halo lento y casi invisible, para que el ojo lo
            encuentre sin que la pantalla parezca que pide algo a gritos. */}
        {grabando ? (
          <motion.span
            aria-hidden
            className="bg-peligro absolute inset-0 rounded-full"
            animate={{ scale: [1, 1.35], opacity: [0.45, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        ) : (
          !ocupado &&
          !menosMovimiento && (
            <motion.span
              aria-hidden
              className="ring-tinta absolute inset-0 rounded-full ring-2"
              animate={{ scale: [1, 1.5], opacity: [0.22, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut', repeatDelay: 1.2 }}
            />
          )
        )}
        {ocupado ? (
          <Loader2 className="size-5 animate-spin" />
        ) : grabando ? (
          <Square className="relative size-5 fill-current" />
        ) : (
          <Mic className="relative size-5" />
        )}
      </span>

      <span className="flex min-w-0 flex-col">
        <span className="text-fg-strong text-[0.875rem] font-semibold">
          {ocupado
            ? 'Guardando tu nota…'
            : grabando
              ? `Grabando · ${minutos}:${String(resto).padStart(2, '0')}`
              : 'Contarlo hablando'}
        </span>
        <span className="text-fg-subtle text-[0.75rem]">
          {grabando
            ? 'Toca otra vez cuando termines'
            : 'Como un audio de WhatsApp. El equipo lo escucha.'}
        </span>
      </span>
    </button>
  );
}
