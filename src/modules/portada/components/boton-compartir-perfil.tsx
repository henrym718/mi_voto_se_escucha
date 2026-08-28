'use client';

import { useState } from 'react';

import { Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { RUTAS } from '@/shared/config/rutas';
import { cn } from '@/shared/lib/utils';

/**
 * Compartir la ficha de alguien del equipo.
 *
 * Es el mismo mecanismo que el de una obra —bandeja del sistema en el teléfono,
 * portapapeles en escritorio— pero con otro mensaje: aquí no se pide apoyo, se
 * presenta a una persona. En campaña, «mira quién es el que va a recibir tu
 * pedido» es lo que se reenvía al grupo del barrio.
 */
export function BotonCompartirPerfil({
  slug,
  nombre,
  cargo,
  className,
}: {
  slug: string;
  nombre: string;
  cargo: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const enlace =
    typeof window !== 'undefined'
      ? `${window.location.origin}${RUTAS.publico.perfil(slug)}`
      : RUTAS.publico.perfil(slug);

  const mensaje = cargo ? `${nombre} — ${cargo}. Mira quién es 👇` : `Mira quién es ${nombre} 👇`;

  async function compartir() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: nombre, text: mensaje, url: enlace });
      } catch {
        // Canceló: no es un error que valga la pena mostrar.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(`${mensaje}\n${enlace}`);
      setCopiado(true);
      toast.success('Enlace copiado. Pégalo donde quieras.');
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      toast.error('No pudimos copiar el enlace.');
    }
  }

  return (
    <button
      type="button"
      onClick={() => void compartir()}
      aria-label={`Compartir la ficha de ${nombre}`}
      className={cn(
        'border-tinta text-fg-strong hover:bg-crema-2 flex min-h-11 items-center gap-2 rounded-full border px-4 text-[0.8125rem] font-bold transition-colors active:translate-y-px',
        className,
      )}
    >
      {copiado ? <Check className="text-exito size-4" /> : <Share2 className="size-4" />}
      {copiado ? 'Copiado' : 'Compartir'}
    </button>
  );
}
