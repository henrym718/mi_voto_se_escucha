'use client';

import Link from 'next/link';

import { ArrowRight, Plus, User } from 'lucide-react';
import { motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { usePortal } from '@/modules/shared/portal.provider';
import { RUTAS } from '@/shared/config/rutas';

import { FichaDelCandidato } from './perfil-candidato.view';

const suave = [0.22, 1, 0.36, 1] as const;

export interface PerfilResumen {
  id: string;
  slug: string;
  nombre: string;
  cargo: string;
  foto_url: string | null;
  es_candidato: boolean;
  resumen: string;
}

/**
 * Las caras del portal. Antes esta página era una sola ficha con el candidato
 * incrustada a mano; ahora es una lista, porque una campaña municipal es un
 * equipo y el vecino quiere saber a quién le está hablando cuando pide algo
 * para su barrio.
 *
 * Cada tarjeta abre una ficha propia con datos básicos: nada de currículums.
 */
export function PerfilesView({ items }: { items: PerfilResumen[] }) {
  const { ciudad } = usePortal();

  // Sin fichas cargadas se enseña el candidato del portal. Es la pantalla que
  // ve un cliente el primer día, antes de sentarse a llenar el panel.
  if (items.length === 0) return <FichaDelCandidato />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 pt-5 pb-10 md:gap-9 md:px-6 md:pt-8 lg:max-w-5xl">
      <div className="flex flex-col gap-1.5">
        <Titulo nivel="h1">Quién está detrás</Titulo>
        <Texto tamano="lg">
          El equipo que va a recibir tu pedido en {ciudad.nombre}. Toca a cualquiera para ver su
          ficha.
        </Texto>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {items.map((perfil, i) => (
          <motion.div
            key={perfil.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.05, ease: suave }}
          >
            <Link
              href={RUTAS.publico.perfil(perfil.slug)}
              className="border-tinta hover:ring-tinta/15 flex h-full flex-col gap-3 rounded-3xl border bg-white p-5 transition-all hover:ring-4 active:translate-y-px"
            >
              <div className="flex items-center gap-3.5">
                {perfil.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={perfil.foto_url}
                    alt={perfil.nombre}
                    className="border-tinta size-16 shrink-0 rounded-full border-2 object-cover"
                  />
                ) : (
                  <div className="border-linea flex size-16 shrink-0 items-center justify-center rounded-full border-2">
                    <User className="text-fg-faint size-7" />
                  </div>
                )}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-fg-strong truncate text-[1rem] leading-tight font-bold tracking-[-0.01em]">
                    {perfil.nombre}
                  </span>
                  {/* Tinta media y semibold: en gris claro los cargos no se
                      leían en la pantalla de un celular al sol. */}
                  <span className="text-fg-muted text-[0.8125rem] leading-tight font-semibold">
                    {perfil.cargo || (perfil.es_candidato ? 'Candidatura' : 'Equipo')}
                  </span>
                </div>
              </div>

              {perfil.resumen && (
                <Texto tamano="sm" className="line-clamp-3">
                  {perfil.resumen}
                </Texto>
              )}

              <span className="text-fg-strong mt-auto flex items-center gap-1.5 pt-1 text-[0.8125rem] font-bold">
                Ver perfil
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.4, ease: suave }}
        className="bg-tinta flex flex-col items-start gap-4 rounded-[28px] p-7 md:flex-row md:items-center md:justify-between md:rounded-[40px] md:p-12"
      >
        <div className="flex flex-col gap-2">
          <Titulo nivel="h2" className="max-w-[20ch] text-white">
            Dinos qué le hace falta a tu barrio
          </Titulo>
          <Texto tamano="lg" className="max-w-[46ch] text-white/70">
            Lo que más se pide es lo que entra primero al plan de obras.
          </Texto>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Button size="lg" variant="claro" asChild>
            <Link href={RUTAS.publico.publicar}>
              <Plus className="size-5" />
              Publicar mi pedido
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="border-white/40 bg-white/10 text-white hover:bg-white/20"
          >
            <Link href={RUTAS.publico.obras}>
              Ver las obras
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </motion.section>
    </div>
  );
}
