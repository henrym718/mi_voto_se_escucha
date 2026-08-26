'use client';

import { useState } from 'react';

import Link from 'next/link';

import {
  ArrowRight,
  ChevronDown,
  HeartHandshake,
  Landmark,
  MapPin,
  Megaphone,
  Play,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';
import { useObras, useRankingBarrio } from '@/modules/obras/hooks/use-obras';
import { CifraAnimada } from '@/modules/shared/components/cifra-animada';
import { usePortal } from '@/modules/shared/portal.provider';
import { RUTAS } from '@/shared/config/rutas';
import { cifra, cn } from '@/shared/lib/utils';

import { SelectorSector } from '../components/selector-sector';
import { type ItemTop, TarjetaTop, TarjetaTopEsqueleto } from '../components/tarjeta-top';

const suave = [0.22, 1, 0.36, 1] as const;

export function PortadaView({ ciudadelaGuardada }: { ciudadelaGuardada?: string | null }) {
  const { ciudad, portal, cifras, haySesion, pedirVerificacion } = usePortal();
  const [verVideo, setVerVideo] = useState(false);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [sector, setSector] = useState<string | null>(ciudadelaGuardada ?? null);

  const { data: ciudadelas = [] } = useCiudadelas(ciudad.id);
  const nombreSector = ciudadelas.find((c) => c.id === sector)?.nombre;

  // El top se ve desde el primer segundo, sin pedirle nada a nadie: por defecto
  // es el de toda la ciudad, y si el vecino elige su sector, se vuelve el suyo.
  const topCiudad = useObras(ciudad.slug, { orden: 'apoyos', limite: 10 });
  const topSector = useRankingBarrio(sector, 10);

  const cargando = sector ? topSector.isLoading : topCiudad.isLoading;
  const items: ItemTop[] = sector
    ? normalizarSector(topSector.data?.items ?? [])
    : normalizarCiudad(topCiudad.data?.items ?? []);

  const elegirSector = (id: string | null) => {
    setSector(id);
    try {
      if (id) localStorage.setItem('mvse:ciudadela', id);
      else localStorage.removeItem('mvse:ciudadela');
    } catch {
      // Modo incógnito: se pierde la preferencia y no pasa nada más.
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 pt-4 pb-10 md:gap-14 md:px-6 lg:max-w-7xl lg:pt-8">
      {/* ============================================================ hero == */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: suave }}
        className="relative overflow-hidden rounded-[28px] md:rounded-[40px]"
        style={{
          background: `linear-gradient(150deg, var(--color-marca) 0%, color-mix(in oklab, var(--color-marca) 72%, black) 100%)`,
        }}
      >
        {/* La foto del partido de fondo, si la campaña la cargó. El velo de
            marca la mantiene legible sin taparla del todo. */}
        {portal?.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portal.banner_url}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: portal?.banner_url
              ? `linear-gradient(105deg, color-mix(in oklab, var(--color-marca) 88%, black) 12%, color-mix(in oklab, var(--color-marca) 72%, black) 55%, color-mix(in oklab, var(--color-marca) 45%, transparent) 100%)`
              : 'radial-gradient(circle at 18% 12%, rgb(255 255 255 / 0.10) 0.5px, transparent 0.6px), radial-gradient(circle at 68% 62%, rgb(255 255 255 / 0.10) 0.5px, transparent 0.6px)',
            backgroundSize: portal?.banner_url ? undefined : '26px 26px, 34px 34px',
          }}
        />

        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:gap-12 md:p-12 lg:p-16">
          <div className="flex flex-1 flex-col gap-5">
            {/* Avatar + identidad del candidato, siempre visibles arriba. */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: suave }}
              className="flex items-center gap-3.5"
            >
              {portal?.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portal.foto_url}
                  alt={portal.candidato_nombre}
                  className="size-16 rounded-full border-[3px] border-white/40 object-cover shadow-md md:size-20"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-full border-[3px] border-white/25 bg-white/15 md:size-20">
                  <Users className="size-7 text-white/80" />
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-[1.125rem] leading-tight font-bold tracking-[-0.02em] text-white md:text-[1.375rem]">
                  {portal?.candidato_nombre || ciudad.nombre}
                </span>
                {(portal?.candidato_cargo || portal?.partido) && (
                  <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[0.75rem] font-semibold text-white/90 backdrop-blur-sm">
                    {[portal?.candidato_cargo, portal?.partido].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18, ease: suave }}
              className="flex flex-col gap-4"
            >
              <Titulo nivel="display" className="max-w-[16ch] text-white">
                {portal?.eslogan || `${ciudad.nombre} lo decidimos entre todos`}
              </Titulo>
              <Texto tamano="lg" className="max-w-[46ch] text-white/85">
                Pide la obra que le hace falta a tu barrio y apoya las de tus vecinos. Las más
                apoyadas entran al plan de obras.
              </Texto>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.26, ease: suave }}
              className="mt-1 flex flex-wrap gap-3"
            >
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
                className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
              >
                <Link href={RUTAS.publico.obras}>
                  Ver todas las obras
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Video con portada y botón: nada de reproducción automática, que en
              datos móviles gasta plata ajena y se siente invasivo. */}
          {portal?.video_url && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3, ease: suave }}
              className="w-full md:w-[24rem] lg:w-[30rem]"
            >
              {verVideo ? (
                <div className="aspect-video overflow-hidden rounded-3xl bg-black shadow-xl">
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
                  className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-3xl bg-black/25 shadow-xl ring-1 ring-white/20 transition-all active:scale-[0.99]"
                >
                  {portal.video_portada_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={portal.video_portada_url}
                      alt=""
                      className="absolute inset-0 size-full object-cover opacity-85 transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  )}
                  <span className="bg-ambar relative flex size-16 items-center justify-center rounded-full shadow-lg transition-transform group-hover:scale-110">
                    <Play className="ml-0.5 size-7 fill-white text-white" />
                  </span>
                  <span className="absolute bottom-3 left-4 text-[0.8125rem] font-medium text-white/90">
                    Conoce mi propuesta
                  </span>
                </button>
              )}
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* =================================================== prueba social == */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.45, ease: suave }}
        className="grid grid-cols-3 gap-3 md:gap-5"
      >
        {/* Blanco con borde negro, como Meetup: el color queda para el icono y
            el número lleva la tinta. */}
        {[
          { valor: cifras.vecinos, etiqueta: 'vecinos verificados', Icono: Users },
          { valor: cifras.obras, etiqueta: 'obras pedidas', Icono: Landmark },
          { valor: cifras.apoyos, etiqueta: 'apoyos sumados', Icono: HeartHandshake },
        ].map((d) => (
          <div
            key={d.etiqueta}
            className="border-tinta flex flex-col gap-2 rounded-3xl border-2 bg-white p-4 transition-transform hover:-translate-y-0.5 md:gap-3 md:p-7"
          >
            <d.Icono className="text-tinta size-7 md:size-9" strokeWidth={1.8} />
            <CifraAnimada
              valor={d.valor}
              className="cifra text-tinta text-[1.5rem] leading-none font-extrabold md:text-[2.5rem]"
            />
            <span className="text-fg-muted text-[0.75rem] leading-tight font-medium md:text-[0.875rem]">
              {d.etiqueta}
            </span>
          </div>
        ))}
      </motion.section>

      {/* ======================================================== el top 10 == */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Titulo nivel="h1">
              {nombreSector ? `Lo más pedido en ${nombreSector}` : 'Las obras más pedidas'}
            </Titulo>
            <Texto>
              {nombreSector
                ? topSector.data && topSector.data.vecinos_ciudadela > 0
                  ? `${cifra(topSector.data.vecinos_ciudadela)} vecinos verificados de este sector ya están participando.`
                  : 'Esto es lo que tus vecinos más quieren que se haga.'
                : `El top 10 de ${ciudad.nombre}. Apoya las que también te hacen falta a ti.`}
            </Texto>
          </div>

          {/* El filtro de sector, imposible de no ver: una píldora grande que
              abre el buscador en un modal. */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSelectorAbierto(true)}
              className={cn(
                'flex min-h-12 items-center gap-2.5 rounded-full border-2 px-5 text-[0.9375rem] font-semibold shadow-xs transition-all active:translate-y-px',
                sector
                  ? 'border-teal bg-teal-pastel text-teal-hondo'
                  : 'border-tinta text-fg-strong bg-white hover:bg-crema-2',
              )}
            >
              <MapPin className="size-4.5" />
              {nombreSector ?? 'Elegir mi sector'}
              <ChevronDown className="size-4 opacity-60" />
            </button>
            {sector && (
              <button
                type="button"
                onClick={() => elegirSector(null)}
                className="text-fg-muted hover:text-fg-strong min-h-12 rounded-full px-3 text-[0.875rem] font-semibold transition-colors"
              >
                Ver toda la ciudad
              </button>
            )}
          </div>
        </div>

        {cargando ? (
          <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <TarjetaTopEsqueleto key={i} indice={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="border-linea flex flex-col items-center gap-2 rounded-3xl border border-dashed bg-white px-6 py-12 text-center">
            <Texto peso="fuerte" tono="normal">
              Todavía no hay pedidos {nombreSector ? 'en este sector' : 'aquí'}.
            </Texto>
            <Texto tamano="sm">Sé quien publique el primero: toma un minuto.</Texto>
            <Button variant="accion" className="mt-2" asChild>
              <Link href={RUTAS.publico.publicar}>
                <Plus className="size-4" />
                Publicar mi pedido
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-4">
              {items.map((obra, i) => (
                <TarjetaTop
                  key={obra.id}
                  obra={obra}
                  indice={i}
                  haySesion={haySesion}
                  onNecesitaSesion={() => pedirVerificacion('apoyar')}
                />
              ))}
            </div>
            <Button size="lg" variant="outline" className="self-center" asChild>
              <Link href={RUTAS.publico.obras}>
                Ver el ranking completo
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        )}
      </section>

      {/* ===================================================== corte oscuro == */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.45, ease: suave }}
        className="bg-tinta relative overflow-hidden rounded-[28px] p-7 md:rounded-[40px] md:p-14"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full opacity-25 blur-3xl"
          style={{ background: 'var(--color-marca)' }}
        />
        <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="flex flex-col gap-2.5">
            <span className="bg-ambar/15 text-ambar flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.75rem] font-bold tracking-[0.1em] uppercase">
              <Megaphone className="size-3.5" />
              Tu voz cuenta
            </span>
            <Titulo nivel="h1" className="max-w-[22ch] text-white">
              ¿Falta la obra de tu barrio en la lista?
            </Titulo>
            <Texto tamano="lg" className="max-w-[48ch] text-white/70">
              Publicarla toma un minuto y solo necesitas tu WhatsApp. Cada apoyo la sube en la
              lista de prioridades.
            </Texto>
          </div>
          <Button size="xl" variant="accion" className="shrink-0" asChild>
            <Link href={RUTAS.publico.publicar}>
              <Plus className="size-5" />
              Publicar mi pedido
            </Link>
          </Button>
        </div>
      </motion.section>

      {/* ========================================================= buscador == */}
      <Link
        href={RUTAS.publico.obras}
        className="border-linea hover:border-teal flex items-center gap-3 rounded-full border bg-white px-5 py-4 shadow-xs transition-all hover:shadow-sm"
      >
        <Search className="text-fg-subtle size-[18px]" />
        <span className="text-fg-subtle flex-1 text-[0.9375rem]">Buscar una obra o un barrio…</span>
        <ArrowRight className="text-fg-faint size-4" />
      </Link>

      <SelectorSector
        abierto={selectorAbierto}
        onCerrar={() => setSelectorAbierto(false)}
        ciudadelas={ciudadelas}
        elegida={sector}
        nombreCiudad={ciudad.nombre}
        onElegir={elegirSector}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------- */

interface ObraCiudad {
  id: string;
  codigo: string;
  titulo: string;
  foto_url: string | null;
  apoyos: number;
  ciudadela: { nombre: string };
  categoria: { nombre: string };
  estado: { nombre: string; color: string };
  ya_apoyada: boolean;
}

function normalizarCiudad(items: ObraCiudad[]): ItemTop[] {
  const maximo = Math.max(...items.map((o) => o.apoyos), 1);
  return items.map((o, i) => ({
    id: o.id,
    codigo: o.codigo,
    titulo: o.titulo,
    foto_url: o.foto_url,
    apoyos: o.apoyos,
    peso: (o.apoyos / maximo) * 100,
    posicion: i + 1,
    categoria: o.categoria.nombre,
    ciudadela: o.ciudadela.nombre,
    estado: o.estado,
    ya_apoyada: o.ya_apoyada,
  }));
}

interface ObraSector {
  id: string;
  codigo: string;
  titulo: string;
  foto_url: string | null;
  apoyos: number;
  porcentaje_ciudadela: number;
  posicion: number;
  categoria: { nombre: string };
  estado: { nombre: string; color: string };
  ya_apoyada: boolean;
}

function normalizarSector(items: ObraSector[]): ItemTop[] {
  const maximo = Math.max(...items.map((o) => o.porcentaje_ciudadela), 1);
  return items.map((o) => ({
    id: o.id,
    codigo: o.codigo,
    titulo: o.titulo,
    foto_url: o.foto_url,
    apoyos: o.apoyos,
    peso: (o.porcentaje_ciudadela / maximo) * 100,
    posicion: o.posicion,
    categoria: o.categoria.nombre,
    estado: o.estado,
    ya_apoyada: o.ya_apoyada,
  }));
}
