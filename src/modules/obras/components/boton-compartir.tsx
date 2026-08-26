'use client';

import { useState } from 'react';

import { Check, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { RUTAS } from '@/shared/config/rutas';
import { cn } from '@/shared/lib/utils';

interface Props {
  codigo: string;
  titulo: string;
  ciudadela: string;
  apoyos: number;
  className?: string;
  variante?: 'boton' | 'pastilla';
}

/**
 * El botón que hace crecer todo esto. Un vecino apoya, lo manda al grupo del
 * barrio, y quien toca el enlace cae directo en la obra y puede apoyarla sin
 * instalar nada. Ese bucle es la adquisición entera del producto.
 */
export function BotonCompartir({
  codigo,
  titulo,
  ciudadela,
  apoyos,
  className,
  variante = 'boton',
}: Props) {
  const [copiado, setCopiado] = useState(false);

  const enlace =
    typeof window !== 'undefined'
      ? `${window.location.origin}${RUTAS.publico.obra(codigo)}`
      : RUTAS.publico.obra(codigo);

  const mensaje =
    apoyos > 0
      ? `Vecinos de ${ciudadela}: ya somos ${apoyos} pidiendo "${titulo}". Apoya tú también 👇`
      : `Vecinos de ${ciudadela}: apoyemos "${titulo}" para que entre al plan de obras 👇`;

  async function compartir() {
    // En móvil abre la bandeja del sistema, con WhatsApp de primero. En
    // escritorio no existe, así que se copia al portapapeles.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: titulo, text: mensaje, url: enlace });
        return;
      } catch {
        // El usuario canceló: no es un error que valga la pena mostrar.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${mensaje}\n${enlace}`);
      setCopiado(true);
      toast.success('Enlace copiado. Pégalo en el grupo de tu barrio.');
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      toast.error('No pudimos copiar el enlace.');
    }
  }

  if (variante === 'pastilla') {
    return (
      <button
        type="button"
        onClick={() => void compartir()}
        aria-label="Compartir esta obra"
        className={cn(
          'border-linea hover:border-tinta hover:bg-crema-2 flex size-11 items-center justify-center rounded-full border bg-white transition-all active:scale-95',
          className,
        )}
      >
        <motion.span
          key={copiado ? 'ok' : 'compartir'}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {copiado ? (
            <Check className="text-exito size-[18px]" />
          ) : (
            <Share2 className="text-fg-muted size-[18px]" />
          )}
        </motion.span>
      </button>
    );
  }

  return (
    <Button variant="outline" onClick={() => void compartir()} className={className}>
      {copiado ? <Check className="text-exito" /> : <Share2 />}
      Compartir al grupo
    </Button>
  );
}
