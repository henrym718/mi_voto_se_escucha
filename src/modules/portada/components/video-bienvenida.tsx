'use client';

import { useEffect, useState } from 'react';

import { X } from 'lucide-react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { usePortal } from '@/modules/shared/portal.provider';

import { idDeYoutube } from './video-presentacion';

const VISTO = 'mvse:video-bienvenida-visto';
const ESPERA_MS = 2500;

/**
 * El video que explica de qué va esto, la primera vez y solo la primera.
 *
 * Quien llega desde un enlace de WhatsApp no sabe si esto es una encuesta, una
 * campaña o un trámite, y esa duda se resuelve en treinta segundos de video
 * mejor que con cualquier texto. Pero es una interrupción, así que se cobra
 * una sola vez en la vida del vecino: se guarda en el navegador que ya lo vio
 * y no vuelve a aparecer.
 *
 * Dos condiciones para que exista: que el equipo haya pegado un enlace de
 * YouTube en el panel, y que sea la primera visita. Sin enlace, este
 * componente no pinta absolutamente nada.
 *
 * Espera un par de segundos antes de abrirse. Encima del primer pintado
 * tapaba la página antes de que se viera, y se leía como una ventana emergente
 * de las de cerrar sin mirar.
 */
export function VideoBienvenida() {
  const { portal } = usePortal();
  const [abierto, setAbierto] = useState(false);

  const id = idDeYoutube(portal?.video_bienvenida_url);

  useEffect(() => {
    if (!id) return;

    // En una ventana privada o con el almacenamiento bloqueado, leer revienta.
    // Si no se puede saber si ya lo vio, se opta por NO interrumpir.
    let visto = true;
    try {
      visto = window.localStorage.getItem(VISTO) === '1';
    } catch {
      return;
    }
    if (visto) return;

    const t = window.setTimeout(() => setAbierto(true), ESPERA_MS);
    return () => window.clearTimeout(t);
  }, [id]);

  function cerrar() {
    setAbierto(false);
    try {
      window.localStorage.setItem(VISTO, '1');
    } catch {
      // Sin almacenamiento volverá a salir en la próxima visita. Es molesto,
      // pero es preferible a no mostrarlo nunca por no poder anotarlo.
    }
  }

  if (!id) return null;

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">Cómo funciona Mi Voto Se Escucha</DialogTitle>

        <div className="aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title="Cómo funciona Mi Voto Se Escucha"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full border-0"
          />
        </div>

        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-col gap-1">
            <Titulo nivel="h3">Así funciona</Titulo>
            <Texto tamano="sm">
              Pide la obra que le hace falta a tu barrio y apoya las de tus vecinos. Lo más apoyado
              entra al plan de trabajo.
            </Texto>
          </div>
          <Button variant="institucional" size="lg" onClick={cerrar} className="w-full">
            <X className="size-4" />
            Entendido, empezar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
