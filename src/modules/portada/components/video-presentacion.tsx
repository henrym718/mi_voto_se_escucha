'use client';

import { useState } from 'react';

import { Play } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/shared/lib/utils';

/**
 * Saca el identificador de un enlace de YouTube, venga en la forma que venga:
 * el equipo pega lo que le da el botón «Compartir» del teléfono, y eso a veces
 * es youtu.be, a veces /shorts/ y a veces un watch?v= con media docena de
 * parámetros de campaña detrás.
 *
 * Devuelve null si no reconoce el enlace, y entonces no se pinta nada: mejor
 * sin botón que un botón que abre un recuadro negro.
 */
export function idDeYoutube(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^(www\.|m\.)/, '');

    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;

    const v = u.searchParams.get('v');
    if (v) return v;

    const partes = u.pathname.split('/').filter(Boolean);
    if (['embed', 'shorts', 'live', 'v'].includes(partes[0])) return partes[1] ?? null;
    return null;
  } catch {
    return null;
  }
}

/**
 * El botón de play que va junto al cargo, y el diálogo con el video.
 *
 * El video no se incrusta en la página: se carga solo al abrir el diálogo.
 * Un iframe de YouTube pesa cerca de un megabyte en scripts, y en un teléfono
 * con datos móviles en El Triunfo eso es media ficha que no llega a pintarse.
 */
export function VideoPresentacion({
  url,
  nombre,
  className,
}: {
  url: string | null | undefined;
  nombre: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const id = idDeYoutube(url);

  if (!id) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Ver el video de presentación de ${nombre}`}
        className={cn(
          'bg-tinta flex min-h-11 items-center gap-2 rounded-full pr-4 pl-2 text-[0.8125rem] font-bold text-white transition-all hover:opacity-90 active:scale-95',
          className,
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
          <Play className="ml-0.5 size-3.5 fill-white text-white" />
        </span>
        Ver presentación
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">Video de presentación de {nombre}</DialogTitle>
          <DialogDescription className="sr-only">
            Video alojado en YouTube en el que {nombre} se presenta.
          </DialogDescription>
          {/* youtube-nocookie: el vecino viene a ver un video de su candidato,
              no a recoger cookies de publicidad de camino. */}
          <div className="aspect-video w-full bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
              title={`Presentación de ${nombre}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full border-0"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
