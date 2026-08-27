'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ChevronLeft, FileText, MapPin, MessageCircle, Play } from 'lucide-react';
import { motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { RUTAS } from '@/shared/config/rutas';
import { fechaLarga, haceCuanto } from '@/shared/lib/fechas';
import { cifra, cn } from '@/shared/lib/utils';

import { BotonApoyar } from '../components/boton-apoyar';
import { BotonCompartir } from '../components/boton-compartir';
import { useObra } from '../hooks/use-obras';
import type { ObraDetalle } from '../types/obras.types';

export function ObraDetalleView({ codigo, inicial }: { codigo: string; inicial?: ObraDetalle }) {
  const router = useRouter();
  const { data: obra = inicial, isLoading } = useObra({ codigo });

  if (isLoading && !obra) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-6">
        <div className="bg-crema-2 h-8 w-3/4 animate-pulse rounded" />
        <div className="bg-crema-2 h-24 w-full animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (!obra) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <Titulo nivel="h2">No encontramos esa obra</Titulo>
        <Texto tamano="sm">Puede que la hayan unido con otra o que el enlace esté mal.</Texto>
        <Button variant="institucional" asChild>
          <Link href={RUTAS.publico.obras}>Ver todas las obras</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 pb-8 md:px-6 md:pt-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-fg-muted hover:text-fg-default -ml-1 flex w-fit items-center gap-1 text-sm font-medium transition-colors"
      >
        <ChevronLeft className="size-4" />
        Volver
      </button>

      {obra.foto_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={obra.foto_url}
          alt=""
          className="max-h-72 w-full rounded-2xl object-cover"
        />
      )}

      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-[0.75rem] font-bold"
            style={{ backgroundColor: `${obra.estado.color}1a`, color: obra.estado.color }}
          >
            {obra.estado.nombre}
          </span>
          <span className="text-fg-subtle flex items-center gap-1 text-[0.8125rem]">
            <MapPin className="size-3.5" />
            {obra.ciudadela.nombre}
          </span>
          <span className="text-fg-subtle text-[0.8125rem]">· {obra.categoria.nombre}</span>
        </div>

        <Titulo nivel="h1">{obra.titulo}</Titulo>

        {obra.descripcion && <Texto tamano="lg">{obra.descripcion}</Texto>}

        {obra.estado.descripcion && (
          <div
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: `${obra.estado.color}12` }}
          >
            <Texto tamano="sm" tono="normal">
              {obra.estado.descripcion}
            </Texto>
          </div>
        )}

        {obra.origen === 'pdot' && obra.fuente && (
          <div className="bg-crema-2 flex items-start gap-2.5 rounded-xl px-4 py-3">
            <FileText className="text-fg-subtle mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <Texto tamano="xs" peso="fuerte" tono="normal">
                De dónde salió este pedido
              </Texto>
              <Texto tamano="xs" tono="tenue">
                {obra.fuente}
              </Texto>
            </div>
          </div>
        )}
      </motion.header>

      {/* ------------------------------------------------------- el apoyo -- */}
      <section className="border-linea flex flex-col gap-4 rounded-2xl border bg-white p-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col">
            <span className="cifra text-fg-strong text-[2.25rem] leading-none font-extrabold">
              {cifra(obra.apoyos)}
            </span>
            <Texto tamano="sm">
              {obra.apoyos === 1 ? 'vecino apoya' : 'vecinos apoyan'} este pedido
            </Texto>
          </div>
        </div>

        <div className="flex gap-2">
          <BotonApoyar
            obraId={obra.id}
            apoyos={obra.apoyos}
            yaApoyada={obra.ya_apoyada}
            tamano="xl"
            mostrarConteo={false}
            className="flex-1"
          />
          <BotonCompartir
            codigo={obra.codigo}
            titulo={obra.titulo}
            ciudadela={obra.ciudadela.nombre}
            apoyos={obra.apoyos}
            className="h-14 shrink-0"
          />
        </div>

        {/* El seguimiento se ve aquí abajo, gratis. Lo que se ofrece por
            WhatsApp es el canal del sector, que no cuesta un centavo por
            persona y lo publica el equipo cuando hay algo real que contar. */}
        {obra.ciudadela.enlace_canal ? (
          <a
            href={obra.ciudadela.enlace_canal}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-strong hover:bg-crema-2 border-linea flex min-h-11 items-center justify-center gap-2 rounded-full border text-[0.875rem] font-semibold transition-colors"
          >
            <MessageCircle className="size-4" />
            Únete al canal de {obra.ciudadela.nombre}
          </a>
        ) : (
          <div className="text-fg-subtle flex items-start gap-2 text-[0.8125rem]">
            <MessageCircle className="mt-0.5 size-4 shrink-0" />
            <span>Los avances de esta obra aparecen aquí abajo, en el seguimiento.</span>
          </div>
        )}
      </section>

      {/* --------------------------------------------------- línea de tiempo -- */}
      <section className="flex flex-col gap-4">
        <Titulo nivel="h3">Seguimiento</Titulo>

        <ol className="flex flex-col">
          {obra.linea_tiempo.map((entrada, i) => (
            <motion.li
              key={entrada.id}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex gap-3.5"
            >
              <div className="flex flex-col items-center">
                <span
                  className="mt-1.5 size-3 shrink-0 rounded-full ring-4"
                  style={{
                    backgroundColor: entrada.estado?.color ?? 'var(--color-tinta-3)',
                    // El halo separa el punto de la línea sin dibujar un borde.
                    ['--tw-ring-color' as string]: 'var(--color-crema)',
                  }}
                />
                {i < obra.linea_tiempo.length - 1 && (
                  <span className="bg-linea my-1 w-0.5 flex-1 rounded-full" />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 pb-6">
                <div className="flex flex-col">
                  <span
                    className="text-[0.875rem] font-bold"
                    style={{ color: entrada.estado?.color ?? 'var(--color-tinta-2)' }}
                  >
                    {entrada.estado?.nombre ?? 'Actualización'}
                  </span>
                  <span className="text-fg-subtle text-[0.75rem]">
                    {fechaLarga(entrada.creada_en)} · {haceCuanto(entrada.creada_en)}
                  </span>
                </div>

                {entrada.texto && (
                  <div className="border-linea rounded-xl border bg-white px-4 py-3">
                    <Texto tamano="sm" tono="normal">
                      {entrada.texto}
                    </Texto>
                  </div>
                )}

                {entrada.media.length > 0 && <Galeria media={entrada.media} />}
              </div>
            </motion.li>
          ))}

          <li className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span className="bg-tinta-3 mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-[var(--color-crema)]" />
            </div>
            <div className="flex flex-col">
              <span className="text-fg-muted text-[0.875rem] font-bold">Pedido publicado</span>
              <span className="text-fg-subtle text-[0.75rem]">
                {fechaLarga(obra.creada_en)}
                {obra.origen === 'vecino' && ' · Publicado por un vecino del sector'}
                {obra.origen === 'pdot' && ' · Cargado desde el plan de desarrollo municipal'}
              </span>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}

function Galeria({ media }: { media: { tipo: string; url: string; miniatura?: string }[] }) {
  return (
    <div className={cn('grid gap-1.5', media.length === 1 ? 'grid-cols-1' : 'grid-cols-3')}>
      {media.slice(0, 6).map((m, i) =>
        m.tipo === 'video' ? (
          <a
            key={i}
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black/80"
          >
            {m.miniatura && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.miniatura} alt="" className="absolute inset-0 size-full object-cover opacity-70" />
            )}
            <span className="bg-tinta relative flex size-10 items-center justify-center rounded-full">
              <Play className="ml-0.5 size-4 fill-white text-white" />
            </span>
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={m.url}
            alt=""
            loading="lazy"
            className={cn(
              'w-full rounded-xl object-cover',
              media.length === 1 ? 'max-h-64' : 'aspect-square',
            )}
          />
        ),
      )}
    </div>
  );
}
