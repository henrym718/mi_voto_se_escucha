'use client';

import Link from 'next/link';

import {
  ArrowLeft,
  AtSign,
  Facebook,
  Instagram,
  Link as LinkIcon,
  Music2,
  Phone,
  Plus,
  User,
  Youtube,
} from 'lucide-react';
import { motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { usePortal } from '@/modules/shared/portal.provider';
import { RUTAS } from '@/shared/config/rutas';

import { BotonCompartirPerfil } from '../components/boton-compartir-perfil';
import { VideoPresentacion } from '../components/video-presentacion';

const suave = [0.22, 1, 0.36, 1] as const;

const ICONO_RED: Record<string, typeof LinkIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
};

export interface Perfil {
  id: string;
  slug: string;
  nombre: string;
  cargo: string;
  cedula: string | null;
  foto_url: string | null;
  bio: string;
  telefono: string | null;
  correo: string | null;
  redes: Record<string, string>;
  es_candidato: boolean;
  video_url: string | null;
}

/**
 * La ficha de una persona del equipo. Deliberadamente corta: cara, cargo, en
 * qué anda y cómo encontrarla. Quien entra aquí está decidiendo si le da su
 * número a esta gente, no leyendo una hoja de vida.
 *
 * Los teléfonos y correos que aparecen son los del equipo, públicos por su
 * cargo. Los de los vecinos no se muestran nunca en ningún lado.
 */
export function PerfilView({ perfil }: { perfil: Perfil }) {
  const { ciudad } = usePortal();

  const redes = Object.entries(perfil.redes ?? {}).filter(([, url]) => Boolean(url));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 pt-4 pb-10 md:gap-9 md:px-6 md:pt-6 lg:max-w-3xl">
      <Link
        href={RUTAS.publico.perfiles}
        className="text-fg-muted hover:text-fg-strong -ml-1 flex w-fit items-center gap-1.5 text-[0.875rem] font-semibold transition-colors"
      >
        <ArrowLeft className="size-4" />
        Todos los perfiles
      </Link>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: suave }}
        className="border-tinta overflow-hidden rounded-[28px] border md:rounded-[40px]"
      >
        <div
          className="h-24 md:h-32"
          style={{
            background: `linear-gradient(150deg, var(--color-marca) 0%, color-mix(in oklab, var(--color-marca) 72%, black) 100%)`,
          }}
        />

        <div className="flex flex-col gap-4 px-5 pb-6 md:px-10 md:pb-9">
          {/* El avatar monta sobre la franja de color: es el recurso que hace
              que una ficha se lea como una persona y no como un formulario. */}
          <div className="-mt-12 md:-mt-14">
            {perfil.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={perfil.foto_url}
                alt={perfil.nombre}
                className="border-tinta size-24 rounded-full border-4 bg-white object-cover md:size-28"
              />
            ) : (
              <div className="border-tinta flex size-24 items-center justify-center rounded-full border-4 bg-white md:size-28">
                <User className="text-fg-faint size-10" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Titulo nivel="h1">{perfil.nombre}</Titulo>
            <div className="flex flex-wrap gap-2">
              {perfil.cargo && (
                <span className="bg-tinta rounded-full px-3.5 py-1.5 text-[0.8125rem] font-bold text-white">
                  {perfil.cargo}
                </span>
              )}
              <span className="border-linea text-fg-muted rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold">
                {ciudad.nombre}
                {ciudad.provincia ? ` · ${ciudad.provincia}` : ''}
              </span>
              {/* La cédula se sigue guardando en el panel —el equipo la
                  necesita para los trámites del CNE— pero no se publica: es un
                  dato personal y en la ficha no le sirve a nadie. */}
              <VideoPresentacion url={perfil.video_url} nombre={perfil.nombre} />
              <BotonCompartirPerfil
                slug={perfil.slug}
                nombre={perfil.nombre}
                cargo={perfil.cargo}
              />
            </div>
          </div>
        </div>
      </motion.section>

      {perfil.bio && (
        <section className="flex flex-col gap-3">
          <Titulo nivel="h2">{perfil.es_candidato ? 'Quién soy' : 'A qué se dedica'}</Titulo>
          {/* La biografía llega como texto plano del panel: cada párrafo se
              separa por línea en blanco y aquí se respeta tal cual. */}
          {perfil.bio
            .split(/\n\s*\n/)
            .map((parrafo) => parrafo.trim())
            .filter(Boolean)
            .map((parrafo, i) => (
              <Texto key={i} tamano="lg" tono="normal" className="max-w-[68ch]">
                {parrafo}
              </Texto>
            ))}
        </section>
      )}

      {(redes.length > 0 || perfil.telefono || perfil.correo) && (
        <section className="flex flex-col gap-3">
          <Titulo nivel="h2">Dónde encontrarme</Titulo>
          <div className="flex flex-wrap gap-2.5">
            {perfil.telefono && (
              <a href={`tel:${perfil.telefono}`} className={PILDORA}>
                <Phone className="size-4" />
                {perfil.telefono}
              </a>
            )}
            {perfil.correo && (
              <a href={`mailto:${perfil.correo}`} className={PILDORA}>
                <AtSign className="size-4" />
                {perfil.correo}
              </a>
            )}
            {redes.map(([nombre, url]) => {
              const Icono = ICONO_RED[nombre.toLowerCase()] ?? LinkIcon;
              return (
                <a
                  key={nombre}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={PILDORA}
                >
                  <Icono className="size-4" />
                  <span className="capitalize">{nombre}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <div className="border-linea flex flex-col items-start gap-3 rounded-3xl border border-dashed p-6 md:flex-row md:items-center md:justify-between">
        <Texto tamano="lg" tono="normal" className="max-w-[42ch]">
          ¿Le hace falta algo a tu barrio? Cuéntalo y suma a los vecinos que ya lo pidieron.
        </Texto>
        <Button size="lg" variant="accion" asChild className="shrink-0">
          <Link href={RUTAS.publico.publicar}>
            <Plus className="size-5" />
            Publicar mi pedido
          </Link>
        </Button>
      </div>
    </div>
  );
}

const PILDORA =
  'border-tinta text-fg-strong hover:bg-crema-2 flex min-h-11 items-center gap-2 rounded-full border px-4 text-[0.875rem] font-semibold transition-colors active:translate-y-px';
