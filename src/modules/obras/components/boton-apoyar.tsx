'use client';

import { Check, Loader2, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Button } from '@/components/ui/button';
import { cifra, cn } from '@/shared/lib/utils';

import { useApoyar, useQuitarApoyo } from '../hooks/use-obras';

interface Props {
  obraId: string;
  apoyos: number;
  yaApoyada: boolean;
  haySesion: boolean;
  onNecesitaSesion: () => void;
  tamano?: 'sm' | 'default' | 'xl';
  className?: string;
  mostrarConteo?: boolean;
}

export function BotonApoyar({
  obraId,
  apoyos,
  yaApoyada,
  haySesion,
  onNecesitaSesion,
  tamano = 'default',
  className,
  mostrarConteo = true,
}: Props) {
  const apoyar = useApoyar();
  const quitar = useQuitarApoyo();
  const cargando = apoyar.isPending || quitar.isPending;

  function alTocar() {
    if (!haySesion) {
      onNecesitaSesion();
      return;
    }
    if (yaApoyada) quitar.mutate(obraId);
    else apoyar.mutate(obraId);
  }

  return (
    <Button
      variant={yaApoyada ? 'outline' : 'accion'}
      size={tamano}
      disabled={cargando}
      onClick={alTocar}
      aria-pressed={yaApoyada}
      className={cn('relative overflow-hidden', className)}
    >
      {cargando ? (
        <Loader2 className="animate-spin" />
      ) : yaApoyada ? (
        <Check className="text-exito" />
      ) : (
        <Plus />
      )}

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
