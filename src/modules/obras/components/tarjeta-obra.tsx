'use client';

import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { MapPin } from 'lucide-react';
import { motion } from 'motion/react';

import { RUTAS } from '@/shared/config/rutas';
import { cifra, cn } from '@/shared/lib/utils';

import type { ObraResumen } from '../types/obras.types';
import { BotonApoyar } from './boton-apoyar';

interface Props {
  obra: ObraResumen;
  /** Puesto en la lista que se está mirando. Se pinta sobre la foto. */
  posicion: number;
  /** 0–100 respecto a la más apoyada de la lista. Alimenta la barra. */
  peso: number;
  indice?: number;
}

/**
 * La tarjeta del feed, y la única que existe: la portada, el listado completo y
 * el top de un sector muestran exactamente lo mismo. Tener dos tarjetas para la
 * misma cosa era la forma segura de que una se quedara atrás.
 *
 * A la izquierda va la foto de la obra —o, si no hay, el puesto en grande—,
 * porque una lista de puro texto no invita a nadie: la obra se tiene que ver.
 */
export function TarjetaObra({ obra, posicion, peso, indice = 0 }: Props) {
  const subiendo = useSubioDePuesto(posicion);

  // El envoltorio existe solo por `layout`: cuando la lista se reordena, Motion
  // mide dónde estaba la tarjeta y dónde quedó, y la desliza hasta su nuevo
  // puesto. Sin esto el cambio es instantáneo y quien acaba de apoyar cree que
  // se contó el apoyo de otra obra. Va aparte del <article> porque ese ya anima
  // `y` al entrar, y dos transformaciones sobre el mismo nodo se estorban.
  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
      // Mientras sube, la tarjeta se pinta por encima de las que bajan: así se
      // lee como "esta subió" y no como "todo se barajó".
      className={cn('relative h-full', subiendo && 'z-20')}
    >
      <motion.article
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.35, delay: Math.min(indice, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="group border-tinta ring-tinta/0 hover:ring-tinta/15 relative flex h-full gap-3.5 rounded-3xl border bg-white p-3.5 ring-4 transition-all hover:-translate-y-0.5 md:gap-4 md:p-4"
      >
        {/* Un solo enlace estirado sobre la tarjeta entera, en vez de uno en la
            foto y otro en el título. Antes, el contador y la barra —que es media
            tarjeta— no eran enlace y quien tocaba ahí no abría nada. Al ir
            posicionado, este enlace se pinta por encima de todo y captura el
            clic caiga donde caiga; el botón de apoyar sube con z-10 para
            seguir siendo él quien recibe el suyo. */}
        <Link
          href={RUTAS.publico.obra(obra.codigo)}
          aria-label={obra.titulo}
          className="absolute inset-0 rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2"
        />

        {/* `relative` porque el número del puesto se posiciona encima, y
            `pointer-events-none` porque eso mismo lo dejaría por delante del
            enlace estirado: sin esto, la foto vuelve a ser la única parte de la
            tarjeta que no abre nada. */}
        <div className="pointer-events-none relative block size-24 shrink-0 overflow-hidden rounded-2xl md:size-28">
          {obra.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={obra.foto_url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="bg-crema-2 flex size-full items-center justify-center">
              <span className="text-fg-faint cifra text-4xl font-extrabold">{posicion}</span>
            </div>
          )}
          <span
            className={cn(
              'cifra absolute top-1.5 left-1.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[0.75rem] font-extrabold shadow-sm',
              posicion <= 3 ? 'bg-tinta text-white' : 'text-fg-default bg-white/95',
            )}
          >
            {posicion}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-col gap-1">
            <span className="text-fg-strong line-clamp-2 text-[0.9375rem] leading-snug font-semibold tracking-[-0.015em] md:text-[1.0625rem]">
              {obra.titulo}
            </span>
            {/* Semibold y en tinta media: en un teléfono al sol, el gris claro de
                antes era ilegible y esta línea dice dónde queda la obra. */}
            <span className="text-fg-muted flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] font-semibold">
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-3.5" />
                {obra.ciudadela.nombre}
              </span>
              <span aria-hidden>·</span>
              <span>{obra.categoria.nombre}</span>
              <span className="border-linea text-fg-strong rounded-full border bg-white px-2 py-0.5 text-[0.68rem] font-bold">
                {obra.estado.nombre}
              </span>
            </span>
          </div>

          {/* La barra dice el peso relativo dentro de la lista. Con apoyo abierto
              a todo el cantón, la proporción frente a la primera se lee mejor que
              el número crudo: dice "cuánto pesa esto aquí", no "cuántos son". */}
          <div className="mt-auto flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="cifra text-fg-strong text-[0.875rem] leading-none font-bold">
                {cifra(obra.apoyos)}
                <span className="text-fg-subtle ml-1 text-[0.7rem] font-medium">
                  {obra.apoyos === 1 ? 'vecino' : 'vecinos'}
                </span>
              </span>
              <div className="bg-crema-2 h-1.5 w-full overflow-hidden rounded-full">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.max(peso, 4)}%` }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.7,
                    delay: 0.2 + Math.min(indice, 6) * 0.05,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="bg-tinta h-full rounded-full"
                />
              </div>
            </div>

            <div className="relative z-10">
              <BotonApoyar
                obraId={obra.id}
                apoyos={obra.apoyos}
                yaApoyada={obra.ya_apoyada}
                tamano="sm"
                mostrarConteo={false}
              />
            </div>
          </div>
        </div>
      </motion.article>
    </motion.div>
  );
}

export function TarjetaObraEsqueleto({ indice = 0 }: { indice?: number }) {
  return (
    <div
      className="border-tinta flex gap-4 rounded-3xl border bg-white p-4"
      style={{ animationDelay: `${indice * 60}ms` }}
    >
      <div className="bg-crema-2 size-24 animate-pulse rounded-2xl md:size-28" />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <div className="bg-crema-2 h-5 w-3/4 animate-pulse rounded" />
        <div className="bg-crema-2 h-4 w-1/2 animate-pulse rounded" />
        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="bg-crema-2 h-4 w-24 animate-pulse rounded" />
          <div className="bg-crema-2 h-9 w-24 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Verdadero durante medio segundo justo después de que la obra gane puestos.
 * Es el único momento en que hace falta levantarla sobre las demás; el resto
 * del tiempo todas las tarjetas comparten plano.
 */
function useSubioDePuesto(posicion: number): boolean {
  const previo = useRef(posicion);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    const anterior = previo.current;
    previo.current = posicion;
    if (posicion >= anterior) return;

    setSubiendo(true);
    const reloj = setTimeout(() => setSubiendo(false), 550);
    return () => clearTimeout(reloj);
  }, [posicion]);

  return subiendo;
}

/**
 * El peso de cada obra respecto a la más apoyada de la lista. Se calcula aquí,
 * en el cliente y sobre lo que ya se descargó, en vez de pedírselo a la base:
 * es una división y ahorra una subconsulta por fila en cada listado.
 */
export function pesosDeLista(obras: { apoyos: number }[]): number[] {
  const techo = Math.max(...obras.map((o) => o.apoyos), 1);
  return obras.map((o) => Math.round((o.apoyos / techo) * 100));
}
