'use client';

import { useRef, useState } from 'react';

import { ImageUp, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Texto } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { subirArchivoDePortal } from '@/modules/obras/services/subida.service';
import { cn } from '@/shared/lib/utils';

interface Props {
  etiqueta: string;
  ayuda?: string;
  valor: string | null;
  onCambio: (url: string | null) => void;
  ciudadId: string;
  /** 'video' acepta mp4/webm; por defecto solo imágenes. */
  tipo?: 'imagen' | 'video';
  /** Proporción de la vista previa. El recorte del hero es alto, el banner ancho. */
  forma?: 'cuadrada' | 'ancha' | 'alta';
  /**
   * Dónde va a parar el archivo. Por defecto al bucket del portal, que es de
   * dónde salió este campo; la foto de un pedido va al de obras, con el resto
   * de fotos de obras, y no mezclada con el material de campaña.
   */
  subir?: (archivo: File) => Promise<string>;
}

const FORMA = {
  cuadrada: 'aspect-square w-28',
  ancha: 'aspect-[16/6] w-full',
  alta: 'aspect-[3/4] w-32',
} as const;

/**
 * Un campo de subida que enseña lo que subió. Sin la vista previa el equipo
 * sube una foto, ve una url y no tiene forma de saber si acertó de archivo —
 * y en la portada de un candidato, equivocarse de foto se nota mucho.
 */
export function CampoArchivo({
  etiqueta,
  ayuda,
  valor,
  onCambio,
  ciudadId,
  tipo = 'imagen',
  forma = 'cuadrada',
  subir,
}: Props) {
  const [subiendo, setSubiendo] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  async function elegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;

    setSubiendo(true);
    try {
      onCambio(subir ? await subir(archivo) : await subirArchivoDePortal(ciudadId, archivo));
    } catch {
      toast.error('No pudimos subir el archivo. Revisa el peso y el formato.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
        {etiqueta}
      </span>

      <div className="flex items-start gap-3">
        <div
          className={cn(
            'border-linea overflow-hidden rounded-2xl border bg-white',
            FORMA[forma],
            // El tablero de ajedrez deja ver la transparencia: es la única forma
            // de saber si el recorte del candidato viene con fondo o sin él.
            'bg-[conic-gradient(#f4f4f5_0_25%,transparent_0_50%,#f4f4f5_0_75%,transparent_0)] bg-[length:14px_14px]',
          )}
        >
          {valor ? (
            tipo === 'video' ? (
              <video src={valor} controls className="size-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={valor} alt="" className="size-full object-contain" />
            )
          ) : (
            <div className="text-fg-faint flex size-full items-center justify-center">
              <ImageUp className="size-6" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={entrada}
            type="file"
            accept={tipo === 'video' ? 'video/mp4,video/webm' : 'image/*'}
            onChange={(e) => void elegir(e)}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={subiendo}
            onClick={() => entrada.current?.click()}
          >
            {subiendo ? <Loader2 className="animate-spin" /> : <ImageUp />}
            {valor ? 'Cambiar' : 'Subir'}
          </Button>
          {valor && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onCambio(null)}>
              <Trash2 />
              Quitar
            </Button>
          )}
          {ayuda && (
            <Texto tamano="xs" tono="tenue" className="max-w-[24ch]">
              {ayuda}
            </Texto>
          )}
        </div>
      </div>
    </div>
  );
}
