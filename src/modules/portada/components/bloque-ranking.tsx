'use client';

import Link from 'next/link';

import { motion } from 'motion/react';

import { Texto } from '@/components/typography';
import { BotonApoyar } from '@/modules/obras/components/boton-apoyar';
import { RUTAS } from '@/shared/config/rutas';
import { cifra, porcentaje } from '@/shared/lib/utils';

interface ItemRanking {
  id: string;
  codigo: string;
  titulo: string;
  apoyos: number;
  porcentaje_ciudadela: number;
  posicion: number;
  categoria: { nombre: string; icono: string };
  estado: { nombre: string; color: string };
  ya_apoyada: boolean;
}

/**
 * El Top del barrio. La barra de fondo muestra el peso relativo de cada obra
 * dentro del sector: con voto ilimitado, el número crudo se aplana y esta
 * proporción es la que deja ver de verdad qué le duele más a la gente.
 */
export function BloqueRanking({
  items,
  haySesion,
  onNecesitaSesion,
}: {
  items: ItemRanking[];
  haySesion: boolean;
  onNecesitaSesion: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="border-linea flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white px-6 py-10 text-center">
        <Texto peso="fuerte" tono="normal">
          Todavía no hay pedidos en este barrio.
        </Texto>
        <Texto tamano="sm">Sé el primero en publicar lo que hace falta aquí.</Texto>
      </div>
    );
  }

  const maximo = Math.max(...items.map((i) => i.porcentaje_ciudadela), 1);

  return (
    <div className="border-linea overflow-hidden rounded-2xl border bg-white">
      {items.map((obra, i) => (
        <motion.div
          key={obra.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="border-linea relative flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0"
        >
          {/* La barra vive detrás del contenido y crece al entrar en pantalla. */}
          <motion.div
            aria-hidden
            initial={{ width: 0 }}
            animate={{ width: `${(obra.porcentaje_ciudadela / maximo) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.15 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="bg-teal-pastel/45 absolute inset-y-0 left-0"
          />

          <span className="cifra text-fg-faint relative w-6 shrink-0 text-[1.125rem] font-extrabold">
            {obra.posicion}
          </span>

          <Link href={RUTAS.publico.obra(obra.codigo)} className="relative flex min-w-0 flex-1 flex-col">
            <span className="text-fg-strong truncate text-[0.9375rem] font-semibold">
              {obra.titulo}
            </span>
            <span className="text-fg-subtle text-[0.75rem]">
              {obra.categoria.nombre} · {cifra(obra.apoyos)}{' '}
              {obra.apoyos === 1 ? 'vecino' : 'vecinos'}
              {obra.porcentaje_ciudadela > 0 && ` · ${porcentaje(obra.porcentaje_ciudadela)} del barrio`}
            </span>
          </Link>

          <div className="relative shrink-0">
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
        </motion.div>
      ))}
    </div>
  );
}
