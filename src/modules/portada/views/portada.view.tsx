'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ArrowRight, MapPin, Play, Plus, Search, Users } from 'lucide-react';
import { motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';
import { TarjetaObraEsqueleto } from '@/modules/obras/components/tarjeta-obra';
import { useRankingBarrio } from '@/modules/obras/hooks/use-obras';
import { CifraAnimada } from '@/modules/shared/components/cifra-animada';
import { usePortal } from '@/modules/shared/portal.provider';
import { RUTAS } from '@/shared/config/rutas';
import { cifra, cn } from '@/shared/lib/utils';

import { BloqueRanking } from '../components/bloque-ranking';

export function PortadaView({ ciudadelaGuardada }: { ciudadelaGuardada?: string | null }) {
  const { ciudad, portal, cifras, haySesion, pedirVerificacion } = usePortal();
  const [verVideo, setVerVideo] = useState(false);
  const [ciudadelaElegida, setCiudadelaElegida] = useState<string | null>(ciudadelaGuardada ?? null);

  const { data: ciudadelas = [] } = useCiudadelas(ciudad.id);
  const { data: ranking, isLoading: cargandoRanking } = useRankingBarrio(ciudadelaElegida, 5);

  const nombreBarrio = ciudadelas.find((c) => c.id === ciudadelaElegida)?.nombre;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-4 pb-8 md:max-w-5xl md:gap-12 md:px-6 md:pt-8">
      {/* ------------------------------------------------------------ hero -- */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl md:rounded-[2rem]"
        style={{
          background: `linear-gradient(150deg, var(--color-marca) 0%, color-mix(in oklab, var(--color-marca) 78%, black) 100%)`,
        }}
      >
        {/* Textura sutil para que el bloque no se vea como un rectángulo plano */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 12%, white 0.5px, transparent 0.6px), radial-gradient(circle at 68% 62%, white 0.5px, transparent 0.6px)',
            backgroundSize: '26px 26px, 34px 34px',
          }}
        />

        <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:gap-10 md:p-10">
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-3">
              {portal?.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portal.foto_url}
                  alt={portal.candidato_nombre}
                  className="size-14 rounded-full border-2 border-white/25 object-cover md:size-16"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-full bg-white/15 md:size-16">
                  <Users className="size-6 text-white/80" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[1.0625rem] font-bold tracking-[-0.02em] text-white md:text-xl">
                  {portal?.candidato_nombre || ciudad.nombre}
                </span>
                <span className="text-[0.8125rem] text-white/70">
                  {[portal?.candidato_cargo, portal?.partido].filter(Boolean).join(' · ')}
                </span>
              </div>
            </div>

            <Titulo nivel="display" tono="inverso" className="max-w-[16ch] text-white">
              {portal?.eslogan || `${ciudad.nombre} lo decidimos entre todos`}
            </Titulo>

            <Texto tamano="lg" className="max-w-[42ch] text-white/80">
              Pide la obra que le hace falta a tu barrio y apoya las de tus vecinos. Las más
              apoyadas entran al plan de obras.
            </Texto>

            <div className="mt-1 flex flex-wrap gap-3">
              <Button size="xl" variant="accion" asChild>
                <Link href={RUTAS.publico.publicar}>
                  <Plus className="size-5" />
                  Publicar mi pedido
                </Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                asChild
                className="border-white/25 bg-white/10 text-white hover:bg-white/20"
              >
                <Link href={RUTAS.publico.obras}>
                  Ver todas las obras
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Video con portada y botón: nada de reproducción automática, que en
              datos móviles gasta plata ajena y se siente invasivo. */}
          {portal?.video_url && (
            <div className="w-full md:w-[22rem] lg:w-[26rem]">
              {verVideo ? (
                <div className="aspect-video overflow-hidden rounded-2xl bg-black">
                  <video
                    src={portal.video_url}
                    controls
                    autoPlay
                    playsInline
                    className="size-full object-contain"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setVerVideo(true)}
                  className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-black/25 ring-1 ring-white/15 transition-all active:scale-[0.99]"
                >
                  {portal.video_portada_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={portal.video_portada_url}
                      alt=""
                      className="absolute inset-0 size-full object-cover opacity-80"
                    />
                  )}
                  <span className="bg-ambar relative flex size-16 items-center justify-center rounded-full shadow-lg transition-transform group-hover:scale-105">
                    <Play className="ml-0.5 size-7 fill-white text-white" />
                  </span>
                  <span className="absolute bottom-3 left-4 text-[0.8125rem] font-medium text-white/85">
                    Conoce mi propuesta
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </motion.section>

      {/* -------------------------------------------------- prueba social -- */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { valor: cifras.vecinos, etiqueta: 'vecinos verificados', fondo: 'bg-teal-pastel', tinta: 'text-teal-hondo' },
          { valor: cifras.obras, etiqueta: 'obras pedidas', fondo: 'bg-ambar-pastel', tinta: 'text-ambar-hondo' },
          { valor: cifras.apoyos, etiqueta: 'apoyos sumados', fondo: 'bg-lavanda', tinta: 'text-morado' },
        ].map((d) => (
          <div key={d.etiqueta} className={cn('flex flex-col gap-0.5 rounded-2xl p-4', d.fondo)}>
            <CifraAnimada
              valor={d.valor}
              className={cn('cifra text-[1.5rem] leading-none font-extrabold md:text-[2rem]', d.tinta)}
            />
            <span className="text-fg-muted text-[0.75rem] leading-tight font-medium">
              {d.etiqueta}
            </span>
          </div>
        ))}
      </motion.section>

      {/* ---------------------------------------------- el barrio del vecino -- */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Titulo nivel="h2">
              {nombreBarrio ? `Lo más pedido en ${nombreBarrio}` : 'Lo más pedido en tu barrio'}
            </Titulo>
            {ranking && ranking.vecinos_ciudadela > 0 && (
              <Texto tamano="sm">
                {cifra(ranking.vecinos_ciudadela)} vecinos verificados de este sector
              </Texto>
            )}
          </div>
          {ciudadelaElegida && (
            <button
              type="button"
              onClick={() => setCiudadelaElegida(null)}
              className="text-teal hover:text-teal-hondo flex items-center gap-1 text-sm font-semibold"
            >
              <MapPin className="size-4" />
              Cambiar barrio
            </button>
          )}
        </div>

        {!ciudadelaElegida ? (
          <SelectorBarrio
            ciudadelas={ciudadelas}
            onElegir={(id) => {
              setCiudadelaElegida(id);
              try {
                localStorage.setItem('mvse:ciudadela', id);
              } catch {
                // Modo incógnito o almacenamiento bloqueado: se pierde la
                // preferencia y no pasa nada más.
              }
            }}
          />
        ) : cargandoRanking ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <TarjetaObraEsqueleto key={i} indice={i} />
            ))}
          </div>
        ) : (
          <BloqueRanking
            items={ranking?.items ?? []}
            haySesion={haySesion}
            onNecesitaSesion={() => pedirVerificacion('apoyar')}
          />
        )}
      </section>

      {/* ------------------------------------------------------- buscador -- */}
      <Link
        href={RUTAS.publico.obras}
        className="border-linea hover:border-teal flex items-center gap-3 rounded-2xl border bg-white px-4 py-4 transition-all"
      >
        <Search className="text-fg-subtle size-[18px]" />
        <span className="text-fg-subtle flex-1 text-[0.9375rem]">
          Buscar una obra o un barrio…
        </span>
        <ArrowRight className="text-fg-faint size-4" />
      </Link>
    </div>
  );
}

function SelectorBarrio({
  ciudadelas,
  onElegir,
}: {
  ciudadelas: { id: string; nombre: string; verificado: boolean }[];
  onElegir: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const filtradas = busqueda.trim()
    ? ciudadelas.filter((c) => c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : ciudadelas.slice(0, 12);

  return (
    <div className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4">
      <Texto tamano="sm">
        Elige tu ciudadela para ver lo que están pidiendo tus vecinos. No hace falta
        registrarse para mirar.
      </Texto>
      <input
        type="search"
        placeholder="Busca tu ciudadela…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="border-linea focus:border-teal focus:ring-teal/20 h-12 w-full rounded-xl border px-4 text-base outline-none transition-all focus:ring-3"
      />
      <div className="flex flex-wrap gap-2">
        {filtradas.map((c, i) => (
          <motion.button
            key={c.id}
            type="button"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: Math.min(i, 10) * 0.02 }}
            onClick={() => onElegir(c.id)}
            className="border-linea hover:border-teal hover:bg-teal-pastel/50 min-h-11 rounded-full border px-4 text-[0.875rem] font-medium transition-all active:scale-95"
          >
            {c.nombre}
          </motion.button>
        ))}
        {filtradas.length === 0 && (
          <Texto tamano="sm" className="py-2">
            No encontramos esa ciudadela.
          </Texto>
        )}
      </div>
    </div>
  );
}
