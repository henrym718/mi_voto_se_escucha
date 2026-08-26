'use client';

import Link from 'next/link';

import { motion } from 'motion/react';
import { FileText, MapPin } from 'lucide-react';

import { Texto } from '@/components/typography';
import { RUTAS } from '@/shared/config/rutas';
import { cifra, porcentaje } from '@/shared/lib/utils';

import type { ObraResumen } from '../types/obras.types';
import { BotonApoyar } from './boton-apoyar';
import { BotonCompartir } from './boton-compartir';

interface Props {
  obra: ObraResumen;
  haySesion: boolean;
  onNecesitaSesion: () => void;
  posicion?: number;
  indice?: number;
}

export function TarjetaObra({ obra, haySesion, onNecesitaSesion, posicion, indice = 0 }: Props) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.32,
        // Las tarjetas entran en cascada, no todas de golpe: da sensación de
        // página viva sin marear. Se corta a los 8 para que el que llega abajo
        // no espere medio segundo.
        delay: Math.min(indice, 8) * 0.045,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="border-linea flex flex-col overflow-hidden rounded-2xl border bg-white shadow-xs transition-shadow hover:shadow-sm"
    >
      <Link href={RUTAS.publico.obra(obra.codigo)} className="flex flex-col gap-2.5 p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {posicion !== undefined && posicion <= 3 && (
            <span className="bg-ambar-pastel text-ambar-hondo cifra rounded-full px-2 py-0.5 text-[0.7rem] font-bold">
              #{posicion} del barrio
            </span>
          )}
          <span
            className="rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold"
            style={{ backgroundColor: `${obra.estado.color}1a`, color: obra.estado.color }}
          >
            {obra.estado.nombre}
          </span>
          <span className="text-fg-subtle flex items-center gap-1 text-[0.75rem]">
            <MapPin className="size-3" />
            {obra.ciudadela.nombre}
          </span>
        </div>

        <h3 className="text-fg-strong text-[1.0625rem] leading-snug font-semibold tracking-[-0.015em]">
          {obra.titulo}
        </h3>

        {obra.descripcion && (
          <Texto tamano="sm" className="line-clamp-2">
            {obra.descripcion}
          </Texto>
        )}

        {/* Los pedidos que vienen del plan municipal dicen de dónde salieron:
            es lo que separa esto de inventarse datos para llenar la pantalla. */}
        {obra.origen === 'pdot' && obra.fuente && (
          <div className="bg-crema-2 flex items-start gap-2 rounded-lg px-3 py-2">
            <FileText className="text-fg-subtle mt-0.5 size-3.5 shrink-0" />
            <Texto tamano="xs" tono="tenue" className="line-clamp-2">
              {obra.fuente}
            </Texto>
          </div>
        )}
      </Link>

      <div className="border-linea flex items-center justify-between gap-3 border-t px-4 py-3">
        <div className="flex flex-col">
          <span className="text-fg-strong cifra text-[1.125rem] leading-none font-bold">
            {cifra(obra.apoyos)}
            <span className="text-fg-subtle ml-1 text-[0.75rem] font-medium">
              {obra.apoyos === 1 ? 'vecino' : 'vecinos'}
            </span>
          </span>
          {obra.porcentaje_ciudadela > 0 && (
            <span className="text-fg-subtle text-[0.7rem]">
              {porcentaje(obra.porcentaje_ciudadela)} de su ciudadela
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <BotonCompartir
            variante="pastilla"
            codigo={obra.codigo}
            titulo={obra.titulo}
            ciudadela={obra.ciudadela.nombre}
            apoyos={obra.apoyos}
          />
          <BotonApoyar
            obraId={obra.id}
            apoyos={obra.apoyos}
            yaApoyada={obra.ya_apoyada}
            haySesion={haySesion}
            onNecesitaSesion={onNecesitaSesion}
            mostrarConteo={false}
          />
        </div>
      </div>
    </motion.article>
  );
}

export function TarjetaObraEsqueleto({ indice = 0 }: { indice?: number }) {
  return (
    <div
      className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4"
      style={{ animationDelay: `${indice * 60}ms` }}
    >
      <div className="flex gap-2">
        <div className="bg-crema-2 h-5 w-24 animate-pulse rounded-full" />
        <div className="bg-crema-2 h-5 w-20 animate-pulse rounded-full" />
      </div>
      <div className="bg-crema-2 h-5 w-3/4 animate-pulse rounded" />
      <div className="bg-crema-2 h-4 w-full animate-pulse rounded" />
      <div className="border-linea mt-1 flex items-center justify-between border-t pt-3">
        <div className="bg-crema-2 h-6 w-20 animate-pulse rounded" />
        <div className="bg-crema-2 h-11 w-28 animate-pulse rounded-full" />
      </div>
    </div>
  );
}
