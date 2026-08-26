'use client';

import Link from 'next/link';

import { MapPin } from 'lucide-react';
import { motion } from 'motion/react';

import { BotonApoyar } from '@/modules/obras/components/boton-apoyar';
import { RUTAS } from '@/shared/config/rutas';
import { cifra, cn } from '@/shared/lib/utils';

/** Forma común del top: sirve tanto para la ciudad entera como para un sector. */
export interface ItemTop {
  id: string;
  codigo: string;
  titulo: string;
  foto_url: string | null;
  apoyos: number;
  /** 0–100, relativo al primero de la lista: alimenta la barra de peso. */
  peso: number;
  posicion: number;
  categoria?: string;
  ciudadela?: string;
  estado: { nombre: string; color: string };
  ya_apoyada: boolean;
}

const PODIO: Record<number, string> = {
  1: 'bg-ambar text-white',
  2: 'bg-tinta text-crema',
  3: 'bg-teal text-white',
};

/**
 * La tarjeta del ranking. A la izquierda va la foto de la obra —o, si no hay,
 * un bloque pastel con el puesto en grande—, porque una lista de puro texto no
 * invita a nadie: la obra se tiene que ver.
 */
export function TarjetaTop({
  obra,
  indice,
  haySesion,
  onNecesitaSesion,
}: {
  obra: ItemTop;
  indice: number;
  haySesion: boolean;
  onNecesitaSesion: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: Math.min(indice, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group border-linea relative flex gap-3.5 rounded-3xl border bg-white p-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md md:gap-4 md:p-4"
    >
      {/* --------------------------------------------------- foto / puesto -- */}
      <Link
        href={RUTAS.publico.obra(obra.codigo)}
        className="relative block size-24 shrink-0 overflow-hidden rounded-2xl md:size-28"
        tabIndex={-1}
        aria-hidden
      >
        {obra.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={obra.foto_url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="bg-teal-pastel flex size-full items-center justify-center">
            <span className="text-teal-hondo/40 cifra text-4xl font-extrabold">
              {obra.posicion}
            </span>
          </div>
        )}
        <span
          className={cn(
            'cifra absolute top-1.5 left-1.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[0.75rem] font-extrabold shadow-sm',
            PODIO[obra.posicion] ?? 'text-fg-default bg-white/95',
          )}
        >
          {obra.posicion}
        </span>
      </Link>

      {/* -------------------------------------------------------- contenido -- */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href={RUTAS.publico.obra(obra.codigo)} className="flex flex-col gap-1">
          <span className="text-fg-strong line-clamp-2 text-[0.9375rem] leading-snug font-semibold tracking-[-0.015em] md:text-[1.0625rem]">
            {obra.titulo}
          </span>
          <span className="text-fg-subtle flex flex-wrap items-center gap-x-1.5 text-[0.75rem]">
            {obra.ciudadela && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-3" />
                {obra.ciudadela}
              </span>
            )}
            {obra.ciudadela && obra.categoria && <span aria-hidden>·</span>}
            {obra.categoria && <span>{obra.categoria}</span>}
            <span
              className="rounded-full px-2 py-0.5 text-[0.68rem] font-bold"
              style={{ backgroundColor: `${obra.estado.color}1a`, color: obra.estado.color }}
            >
              {obra.estado.nombre}
            </span>
          </span>
        </Link>

        {/* La barra dice el peso relativo: con voto ilimitado, la proporción
            frente al primero cuenta más que el número crudo. */}
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
                whileInView={{ width: `${Math.max(obra.peso, 4)}%` }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.7,
                  delay: 0.2 + Math.min(indice, 6) * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="bg-teal h-full rounded-full"
              />
            </div>
          </div>

          <BotonApoyar
            obraId={obra.id}
            apoyos={obra.apoyos}
            yaApoyada={obra.ya_apoyada}
            haySesion={haySesion}
            onNecesitaSesion={onNecesitaSesion}
            tamano="sm"
            mostrarConteo={false}
          />
        </div>
      </div>
    </motion.article>
  );
}

export function TarjetaTopEsqueleto({ indice = 0 }: { indice?: number }) {
  return (
    <div
      className="border-linea flex gap-4 rounded-3xl border bg-white p-4"
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
