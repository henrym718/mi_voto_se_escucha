'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ChevronDown, MapPin, Megaphone, Play, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';
import {
  TarjetaObra,
  TarjetaObraEsqueleto,
  pesosDeLista,
} from '@/modules/obras/components/tarjeta-obra';
import { useObras } from '@/modules/obras/hooks/use-obras';
import { CifraAnimada } from '@/modules/shared/components/cifra-animada';
import { usePortal } from '@/modules/shared/portal.provider';
import { RUTAS } from '@/shared/config/rutas';
import { cifra } from '@/shared/lib/utils';

import { HeroCandidato } from '../components/hero-candidato';
import { SelectorSector } from '../components/selector-sector';
import { VideoBienvenida } from '../components/video-bienvenida';

/** Cuántas tarjetas antes de "Ver más". Diez llenan la pantalla sin cansar. */
const EN_PORTADA = 10;

/**
 * La portada.
 *
 * Todo lo que se ve antes de bajar dice una sola cosa: qué necesita tu sector.
 * No hay foto de cartelera del candidato — la propaganda tradicional en el
 * primer pliegue activa el filtro anti-política y la persona rebota. Lo que hay
 * es el titular, el selector de sector y las causas más apoyadas, con su botón.
 *
 * Nadie tiene que registrarse para nada de esto: se entra, se mira y se apoya.
 */
export function PortadaView() {
  const { ciudad, portal, cifras, sector, elegirSector } = usePortal();
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [verVideo, setVerVideo] = useState(false);

  const { data: ciudadelas = [] } = useCiudadelas(ciudad.id);
  const nombreSector = ciudadelas.find((c) => c.id === sector)?.nombre;

  const { data, isLoading } = useObras(ciudad.slug, {
    ciudadelaId: sector,
    orden: 'apoyos',
    limite: EN_PORTADA,
  });

  const obras = data?.items ?? [];
  const total = data?.total ?? 0;
  const pesos = pesosDeLista(obras);

  const hayVideo = Boolean(portal?.video_url);

  return (
    <>
      {/* Solo en la portada, no en el layout: a quien llega desde un enlace de
          WhatsApp a una obra concreta no se le tapa la obra con un video. */}
      <VideoBienvenida />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-6 pb-10 md:px-6 md:pt-10">
        {/* --------------------------------------------- portada del candidato -- */}
        {/* Apagada de fábrica. Se enciende desde el panel, en Portada y
            perfiles, y ahí está escrito lo que cuesta encenderla. */}
        {portal?.hero_candidato && (
          <HeroCandidato
            nombre={portal.candidato_nombre ?? ''}
            cargo={portal.candidato_cargo ?? ''}
            partido={portal.partido ?? ''}
            eslogan={portal.eslogan ?? ''}
            fotoUrl={portal.foto_url ?? null}
            bannerUrl={portal.banner_url ?? null}
          />
        )}

        {/* ------------------------------------------------------- titular -- */}
        <header className="flex flex-col gap-3">
          <Titulo nivel="display" className="max-w-[16ch]">
            ¿Qué necesita tu sector?
          </Titulo>
          <Texto tamano="lg" className="max-w-[46ch]">
            {portal?.hero_subtitulo ||
              `Dinos qué le hace falta a tu barrio y apoya lo que piden tus vecinos. Lo más apoyado entra al plan de trabajo${portal?.candidato_nombre ? ` de ${portal.candidato_nombre}` : ''}.`}
          </Texto>

          <div className="flex flex-wrap items-center gap-3">
            {/* El video del candidato existe, pero como oferta y no como
                obstáculo: quien quiere oírlo toca; quien viene a reportar su
                problema no tiene que pasar por encima de él. */}
            {hayVideo && (
              <button
                type="button"
                onClick={() => setVerVideo(true)}
                className="border-tinta text-fg-strong hover:bg-crema-2 flex min-h-11 items-center gap-2 rounded-full border-2 bg-white px-4 text-[0.875rem] font-semibold transition-colors"
              >
                <span className="bg-tinta flex size-6 items-center justify-center rounded-full">
                  <Play className="size-3 fill-white text-white" />
                </span>
                Ver el mensaje del candidato
              </button>
            )}
            {/* Sin la cédula. Se sigue guardando en el panel porque el equipo
                la necesita para los trámites del CNE, pero publicarla en la
                portada no le sirve a ningún vecino y es un dato personal
                puesto donde lo lee cualquiera. */}
            {portal?.partido && (
              <Texto tamano="sm" tono="tenue">
                {portal.partido}
              </Texto>
            )}
          </div>
        </header>

        {/* ------------------------------------------------ selector sector -- */}
        <button
          type="button"
          onClick={() => setSelectorAbierto(true)}
          className="border-tinta hover:bg-crema-2 flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 text-left transition-colors"
        >
          <span className="bg-tinta flex size-9 shrink-0 items-center justify-center rounded-full">
            <MapPin className="size-4.5 text-white" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-fg-subtle text-[0.6875rem] font-bold tracking-wide uppercase">
              Estás viendo
            </span>
            <span className="text-fg-strong truncate text-[1rem] font-bold">
              {nombreSector ?? `Todo el cantón · ${ciudad.nombre}`}
            </span>
          </span>
          <ChevronDown className="text-fg-muted size-5 shrink-0" />
        </button>

        {/* ---------------------------------------------------------- feed -- */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <TarjetaObraEsqueleto key={i} indice={i} />
            ))}
          </div>
        ) : obras.length === 0 ? (
          <SectorVacio nombreSector={nombreSector} />
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {obras.map((obra, i) => (
                <TarjetaObra
                  key={obra.id}
                  obra={obra}
                  posicion={i + 1}
                  peso={pesos[i]}
                  indice={i}
                />
              ))}
            </AnimatePresence>

            {total > obras.length && (
              <Button variant="outline" size="lg" asChild className="w-full">
                <Link href={RUTAS.publico.obras}>
                  Ver las {cifra(total - obras.length)} restantes
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Las cifras van al final, no arriba: al que llega no le interesan
            hasta que ya vio de qué se trata. */}
        {cifras.apoyos > 0 && (
          <div className="border-linea flex items-center justify-around gap-4 rounded-2xl border bg-white px-4 py-5">
            <Cifra valor={cifras.apoyos} etiqueta="apoyos" />
            <span className="bg-linea h-8 w-px" aria-hidden />
            <Cifra valor={cifras.obras} etiqueta="causas" />
            <span className="bg-linea h-8 w-px" aria-hidden />
            <Cifra valor={cifras.vecinos} etiqueta="vecinos" />
          </div>
        )}
      </div>

      <SelectorSector
        abierto={selectorAbierto}
        onCerrar={() => setSelectorAbierto(false)}
        ciudadelas={ciudadelas}
        elegida={sector}
        nombreCiudad={ciudad.nombre}
        onElegir={elegirSector}
      />

      <AnimatePresence>
        {verVideo && portal?.video_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVerVideo(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          >
            <button
              type="button"
              aria-label="Cerrar el video"
              onClick={() => setVerVideo(false)}
              className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
            >
              <X className="size-5" />
            </button>
            {/* El video lo sube el equipo desde el panel; no hay pista de
                subtítulos que ofrecer aquí. */}
            <video
              src={portal.video_url}
              poster={portal.video_portada_url ?? undefined}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85dvh] w-full max-w-sm rounded-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Un sector sin causas no es un error, es la mejor oportunidad de la página:
 * quien lo mira es el primero de su barrio y hay que decírselo así.
 */
function SectorVacio({ nombreSector }: { nombreSector?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-tinta flex flex-col items-center gap-4 rounded-3xl border-2 bg-white px-6 py-10 text-center"
    >
      <span className="bg-tinta flex size-14 items-center justify-center rounded-full">
        <Megaphone className="size-7 text-white" />
      </span>
      <div className="flex flex-col gap-1.5">
        <Titulo nivel="h2">
          {nombreSector
            ? `En ${nombreSector} todavía no hay nada registrado`
            : 'Todavía no hay causas registradas'}
        </Titulo>
        <Texto>Sé el primero en decirle al equipo qué hace falta aquí.</Texto>
      </div>
      <Button variant="accion" size="xl" asChild className="w-full max-w-xs">
        <Link href={RUTAS.publico.publicar}>
          <Megaphone />
          Publicar lo que falta
        </Link>
      </Button>
    </motion.div>
  );
}

function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <CifraAnimada
        valor={valor}
        className="text-fg-strong cifra text-[1.5rem] leading-none font-extrabold"
      />
      <span className="text-fg-subtle text-[0.75rem] font-semibold">{etiqueta}</span>
    </div>
  );
}
