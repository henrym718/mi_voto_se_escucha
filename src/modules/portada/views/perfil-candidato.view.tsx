'use client';

import Link from 'next/link';

import {
  ArrowRight,
  Facebook,
  Instagram,
  Link as LinkIcon,
  Music2,
  Plus,
  Users,
  Youtube,
} from 'lucide-react';
import { motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { usePortal } from '@/modules/shared/portal.provider';
import { RUTAS } from '@/shared/config/rutas';

const suave = [0.22, 1, 0.36, 1] as const;

const ICONO_RED: Record<string, typeof LinkIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
};

/**
 * Quién está detrás del portal. Es la página que contesta "¿y este quién es?"
 * antes de que alguien deje su número, así que va la cara, el cargo al que
 * aspira y lo que dice que va a hacer — nada de relleno.
 */
export function EquipoView() {
  const { ciudad, portal } = usePortal();

  const redes = Object.entries(portal?.redes ?? {}).filter(([, url]) => Boolean(url));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-4 pb-10 md:gap-10 md:px-6 md:pt-8 lg:max-w-4xl">
      {/* ------------------------------------------------------- cabecera -- */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: suave }}
        className="border-tinta overflow-hidden rounded-[28px] border md:rounded-[40px]"
      >
        {/* Banner del partido, o una franja del color de marca si no hay foto. */}
        <div
          className="relative h-32 md:h-52"
          style={{
            background: `linear-gradient(150deg, var(--color-marca) 0%, color-mix(in oklab, var(--color-marca) 72%, black) 100%)`,
          }}
        >
          {portal?.banner_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portal.banner_url}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          )}
        </div>

        <div className="flex flex-col gap-4 px-5 pt-0 pb-6 md:px-10 md:pb-10">
          {/* El avatar monta sobre el banner: es el recurso que hace que una
              ficha de persona se lea como una persona y no como un formulario. */}
          <div className="-mt-12 flex items-end gap-4 md:-mt-16">
            {portal?.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={portal.foto_url}
                alt={portal.candidato_nombre}
                className="border-tinta size-24 shrink-0 rounded-full border-4 bg-white object-cover md:size-32"
              />
            ) : (
              <div className="border-tinta flex size-24 shrink-0 items-center justify-center rounded-full border-4 bg-white md:size-32">
                <Users className="text-fg-faint size-10" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Titulo nivel="h1">{portal?.candidato_nombre || ciudad.nombre}</Titulo>
              <div className="flex flex-wrap gap-2">
                {portal?.candidato_cargo && (
                  <span className="bg-tinta rounded-full px-3.5 py-1.5 text-[0.8125rem] font-bold text-white">
                    {portal.candidato_cargo}
                  </span>
                )}
                {portal?.partido && (
                  <span className="border-tinta text-fg-strong rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-bold">
                    {portal.partido}
                  </span>
                )}
                <span className="border-linea text-fg-muted rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold">
                  {ciudad.nombre}
                  {ciudad.provincia ? ` · ${ciudad.provincia}` : ''}
                </span>
              </div>
            </div>

            {portal?.eslogan && (
              <Titulo nivel="h3" tono="fuerte" className="max-w-[30ch]">
                “{portal.eslogan}”
              </Titulo>
            )}
          </div>
        </div>
      </motion.section>

      {/* ------------------------------------------------------------ bio -- */}
      {portal?.bio && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, ease: suave }}
          className="flex flex-col gap-3"
        >
          <Titulo nivel="h2">Quién soy</Titulo>
          {/* La biografía llega como texto plano del panel: cada párrafo se
              separa por línea en blanco y aquí se respeta tal cual. */}
          {portal.bio
            .split(/\n\s*\n/)
            .map((parrafo) => parrafo.trim())
            .filter(Boolean)
            .map((parrafo, i) => (
              <Texto key={i} tamano="lg" tono="normal" className="max-w-[68ch]">
                {parrafo}
              </Texto>
            ))}
        </motion.section>
      )}

      {/* ----------------------------------------------------------- redes -- */}
      {redes.length > 0 && (
        <section className="flex flex-col gap-3">
          <Titulo nivel="h2">Dónde encontrarme</Titulo>
          <div className="flex flex-wrap gap-2.5">
            {redes.map(([nombre, url]) => {
              const Icono = ICONO_RED[nombre.toLowerCase()] ?? LinkIcon;
              return (
                <a
                  key={nombre}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-tinta text-fg-strong hover:bg-crema-2 flex min-h-11 items-center gap-2 rounded-full border px-4 text-[0.875rem] font-semibold transition-colors active:translate-y-px"
                >
                  <Icono className="size-4" />
                  <span className="capitalize">{nombre}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ cta -- */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.4, ease: suave }}
        className="bg-tinta flex flex-col items-start gap-4 rounded-[28px] p-7 md:flex-row md:items-center md:justify-between md:rounded-[40px] md:p-12"
      >
        <div className="flex flex-col gap-2">
          <Titulo nivel="h2" className="max-w-[20ch] text-white">
            Dime qué le hace falta a tu barrio
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
