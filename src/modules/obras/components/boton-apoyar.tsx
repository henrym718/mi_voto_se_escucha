'use client';

import { Check, Loader2, ThumbsUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Button } from '@/components/ui/button';
import { usePortal } from '@/modules/shared/portal.provider';
import { cifra, cn } from '@/shared/lib/utils';

import { useApoyar, useQuitarApoyo } from '../hooks/use-obras';

interface Props {
  obraId: string;
  apoyos: number;
  yaApoyada: boolean;
  tamano?: 'sm' | 'default' | 'xl';
  className?: string;
  mostrarConteo?: boolean;
}

/**
 * El botón que sostiene el producto. Un toque y el apoyo queda contado: no
 * pregunta nada antes porque la sesión anónima ya identifica a quien toca.
 *
 * Solo después de contarlo, y solo la primera vez, aparece la hoja del teléfono.
 * El vecino puede cerrarla y su apoyo sigue en pie.
 */
export function BotonApoyar({
  obraId,
  apoyos,
  yaApoyada,
  tamano = 'default',
  className,
  mostrarConteo = true,
}: Props) {
  const { tieneContacto, pedirContacto } = usePortal();

  const apoyar = useApoyar(() => {
    if (!tieneContacto) pedirContacto('apoyar');
  });
  const quitar = useQuitarApoyo();
  const cargando = apoyar.isPending || quitar.isPending;

  return (
    <Button
      variant={yaApoyada ? 'outline' : 'accion'}
      size={tamano}
      disabled={cargando}
      onClick={() => (yaApoyada ? quitar.mutate(obraId) : apoyar.mutate(obraId))}
      aria-pressed={yaApoyada}
      className={cn('relative overflow-hidden', className)}
    >
      {/* El pulgar arriba es el gesto de "yo también": se entiende sin leer,
          que es justo lo que hace falta en el botón más importante. */}
      {cargando ? <Loader2 className="animate-spin" /> : yaApoyada ? <Check /> : <ThumbsUp />}

      <span>{yaApoyada ? 'Ya apoyaste' : 'Apoyar'}</span>

      {mostrarConteo && (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={apoyos}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="cifra font-bold"
          >
            {cifra(apoyos)}
          </motion.span>
        </AnimatePresence>
      )}
    </Button>
  );
}
