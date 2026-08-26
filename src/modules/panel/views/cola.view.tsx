'use client';

import { useState } from 'react';

import { Check, Copy, Inbox, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { haceCuanto } from '@/shared/lib/fechas';

import { useAprobar, useCola, useRechazar } from '../hooks/use-panel';
import { usePanel } from '../panel.provider';

/**
 * La cola de revisión. Existe para que nunca aparezca un insulto o propaganda
 * del rival en la página del candidato: nada se publica sin que alguien del
 * equipo lo mire. Revisar veinte pedidos toma un par de minutos.
 */
export function ColaView() {
  const { ciudad } = usePanel();
  const { data: pedidos = [], isLoading } = useCola(ciudad.id);
  const aprobar = useAprobar(ciudad.id);
  const rechazar = useRechazar(ciudad.id);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Titulo nivel="h1">Pedidos por revisar</Titulo>
        <Texto tamano="sm">
          {isLoading
            ? 'Cargando…'
            : pedidos.length === 0
              ? 'No hay nada pendiente. Todo al día.'
              : `${pedidos.length} ${pedidos.length === 1 ? 'pedido espera' : 'pedidos esperan'} tu visto bueno.`}
        </Texto>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-12">
          <Loader2 className="text-teal size-5 animate-spin" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="border-linea flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white px-6 py-16 text-center">
          <Inbox className="text-fg-faint size-8" />
          <Texto peso="fuerte" tono="normal">
            Bandeja vacía
          </Texto>
          <Texto tamano="sm">Cuando un vecino publique algo, aparecerá aquí.</Texto>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {pedidos.map((pedido) => (
              <motion.article
                key={pedido.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
                className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-crema-2 text-fg-muted rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold">
                    {pedido.ciudadela}
                  </span>
                  <span className="bg-crema-2 text-fg-muted rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold">
                    {pedido.categoria}
                  </span>
                  <span className="text-fg-subtle text-[0.75rem]">{haceCuanto(pedido.creada_en)}</span>

                  {/* La señal que evita duplicados antes de que ocurran. */}
                  {pedido.similares > 0 && (
                    <span className="bg-arena text-alerta flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold">
                      <Copy className="size-3" />
                      {pedido.similares} parecido{pedido.similares === 1 ? '' : 's'} en el sector
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  {pedido.foto_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pedido.foto_url}
                      alt=""
                      className="size-20 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-fg-strong text-[1rem] font-semibold">{pedido.titulo}</span>
                    {pedido.descripcion && (
                      <Texto tamano="sm" className="line-clamp-3">
                        {pedido.descripcion}
                      </Texto>
                    )}
                  </div>
                </div>

                {rechazando === pedido.id ? (
                  <div className="border-linea flex flex-col gap-2 rounded-xl border bg-crema-2 p-3">
                    <Texto tamano="xs" peso="fuerte" tono="normal">
                      ¿Por qué se descarta? Queda registrado en la bitácora.
                    </Texto>
                    <input
                      autoFocus
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ej. Duplicado del pedido de la calle 4"
                      className="border-linea focus:border-teal h-11 w-full rounded-lg border bg-white px-3 text-[0.875rem] outline-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRechazando(null);
                          setMotivo('');
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={motivo.trim().length < 5 || rechazar.isPending}
                        onClick={async () => {
                          await rechazar.mutateAsync({ obraId: pedido.id, motivo: motivo.trim() });
                          setRechazando(null);
                          setMotivo('');
                        }}
                      >
                        Descartar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="institucional"
                      disabled={aprobar.isPending}
                      onClick={() => aprobar.mutate(pedido.id)}
                      className="flex-1"
                    >
                      <Check />
                      Publicar
                    </Button>
                    <Button variant="outline" onClick={() => setRechazando(pedido.id)}>
                      <X />
                      Descartar
                    </Button>
                  </div>
                )}
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
