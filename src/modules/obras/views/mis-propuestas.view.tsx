'use client';

import Link from 'next/link';

import { Clock, GitMerge, Loader2, MapPin, MessageSquareOff, Plus, Send } from 'lucide-react';
import { motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { RUTAS } from '@/shared/config/rutas';
import { cifra, cn } from '@/shared/lib/utils';

import { BotonCompartir } from '../components/boton-compartir';
import { useMisPropuestas } from '../hooks/use-obras';
import type { Propuesta } from '../services/obras.service';

/**
 * Lo que pedí yo, y qué pasó con ello.
 *
 * Es la mitad que faltaba de publicar. Hasta aquí, un vecino mandaba su pedido,
 * leía «recibido» y no volvía a saber nada: su pedido no sale en la lista
 * pública hasta que lo aprueban, y si lo unificaron con otro parecido, su
 * enlace llevaba a una obra que ya no se muestra.
 *
 * Los cuatro finales posibles se cuentan sin rodeos, incluido el que no gusta.
 * Un «descartado» explicado se aguanta; el silencio, no.
 */
export function MisPropuestasView() {
  const { data: propuestas = [], isLoading } = useMisPropuestas();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-5 pb-10 md:px-6 md:pt-8">
      <div className="flex flex-col gap-1.5">
        <Titulo nivel="h1">Mis propuestas</Titulo>
        <Texto tamano="lg">
          Todo lo que has pedido, con lo que pasó con cada cosa. Solo lo ves tú, desde este
          teléfono.
        </Texto>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="text-fg-muted size-6 animate-spin" />
        </div>
      ) : propuestas.length === 0 ? (
        <Vacio />
      ) : (
        <div className="flex flex-col gap-3">
          {propuestas.map((p, i) => (
            <Tarjeta key={p.id} propuesta={p} indice={i} />
          ))}
        </div>
      )}

      {/* El aviso que evita el reclamo. Es mejor decirlo aquí, donde alguien
          puede acordarse de guardar el enlace, que descubrirlo al cambiar de
          teléfono y encontrarse la lista vacía. */}
      {propuestas.length > 0 && (
        <Texto tamano="xs" tono="tenue">
          Esta lista vive en este teléfono, sin cuenta ni contraseña. Si borras los datos del
          navegador o entras desde otro aparato, no la vas a ver: guarda el enlace de tus propuestas
          publicadas para no perderlas de vista.
        </Texto>
      )}
    </div>
  );
}

function Vacio() {
  return (
    <div className="border-linea flex flex-col items-center gap-4 rounded-3xl border border-dashed px-6 py-12 text-center">
      <span className="bg-crema-2 flex size-14 items-center justify-center rounded-full">
        <Send className="text-fg-faint size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <Titulo nivel="h3">Todavía no has pedido nada</Titulo>
        <Texto tamano="sm" className="max-w-[38ch]">
          Cuando cuentes qué le hace falta a tu barrio, aparecerá aquí y podrás seguir en qué va.
        </Texto>
      </div>
      <Button size="lg" variant="accion" asChild>
        <Link href={RUTAS.publico.publicar}>
          <Plus className="size-5" />
          Publicar mi pedido
        </Link>
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------- piezas -- */

const SITUACION = {
  en_revision: {
    etiqueta: 'En revisión',
    Icono: Clock,
    clase: 'bg-arena text-alerta',
  },
  publicada: {
    etiqueta: 'Publicada',
    Icono: Send,
    clase: 'bg-exito-pastel text-exito',
  },
  unificada: {
    etiqueta: 'Unida a otro pedido',
    Icono: GitMerge,
    clase: 'bg-crema-2 text-fg-muted',
  },
  descartada: {
    etiqueta: 'Descartada',
    Icono: MessageSquareOff,
    clase: 'bg-crema-2 text-fg-muted',
  },
} as const;

function Tarjeta({ propuesta: p, indice }: { propuesta: Propuesta; indice: number }) {
  const { etiqueta, Icono, clase } = SITUACION[p.situacion];

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(indice, 6) * 0.05 }}
      className="border-tinta flex flex-col gap-3 rounded-3xl border bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[0.75rem] font-bold',
            clase,
          )}
        >
          <Icono className="size-3.5" />
          {etiqueta}
        </span>
        {p.situacion === 'publicada' && p.estado && (
          <span
            className="flex min-h-7 items-center rounded-full px-2.5 text-[0.75rem] font-bold text-white"
            style={{ backgroundColor: p.estado.color }}
          >
            {p.estado.nombre}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-fg-strong text-[1rem] leading-snug font-semibold">{p.titulo}</span>
        {!p.tiene_titulo && (
          <Texto tamano="xs" tono="tenue">
            Esto es lo que contaste. El equipo lo está redactando.
          </Texto>
        )}
        <span className="text-fg-muted flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] font-semibold">
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="size-3.5" />
            {p.ciudadela}
          </span>
          <span aria-hidden>·</span>
          <span>{p.categoria}</span>
        </span>
      </div>

      {/* Lo que le pasó, contado como se lo contarías de frente. */}
      {p.situacion === 'en_revision' && (
        <Texto tamano="sm">
          El equipo lo está revisando antes de publicarlo. Cuando entre, aparece en la lista del
          cantón y tus vecinos pueden apoyarlo.
        </Texto>
      )}

      {p.situacion === 'publicada' && (
        <div className="flex flex-col gap-2.5">
          {p.estado?.descripcion && <Texto tamano="sm">{p.estado.descripcion}</Texto>}
          <div className="flex items-center gap-2">
            <span className="cifra text-fg-strong text-[1.125rem] leading-none font-bold">
              {cifra(p.apoyos)}
            </span>
            <Texto tamano="sm" tono="tenue">
              {p.apoyos === 1 ? 'vecino lo apoya' : 'vecinos lo apoyan'}
            </Texto>
          </div>
          {/* El que pidió es quien lo va a mandar al grupo del barrio. Es el
              mejor vendedor que tiene esto, y aquí tiene el botón a mano. */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={RUTAS.publico.obra(p.codigo)}>Ver mi obra</Link>
            </Button>
            <BotonCompartir
              codigo={p.codigo}
              titulo={p.titulo}
              ciudadela={p.ciudadela}
              apoyos={p.apoyos}
            />
          </div>
        </div>
      )}

      {p.situacion === 'unificada' && p.destino && (
        <div className="flex flex-col gap-2.5">
          <Texto tamano="sm">
            Otros vecinos habían pedido lo mismo, así que se juntó todo en un solo pedido para que
            pese más. Tu apoyo y el de ellos cuentan ahí.
          </Texto>
          <div className="bg-crema-2 flex flex-col gap-1 rounded-2xl px-4 py-3">
            <Texto tamano="sm" peso="fuerte" tono="normal">
              {p.destino.titulo}
            </Texto>
            <Texto tamano="xs" tono="tenue">
              {cifra(p.destino.apoyos)} {p.destino.apoyos === 1 ? 'vecino' : 'vecinos'} en total
            </Texto>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={RUTAS.publico.obra(p.destino.codigo)}>Ver el pedido unido</Link>
            </Button>
            <BotonCompartir
              codigo={p.destino.codigo}
              titulo={p.destino.titulo}
              ciudadela={p.ciudadela}
              apoyos={p.destino.apoyos}
            />
          </div>
        </div>
      )}

      {p.situacion === 'descartada' && (
        <div className="flex flex-col gap-2.5">
          <Texto tamano="sm">
            El equipo no lo publicó. {p.motivo_rechazo ? 'Esto fue lo que dijeron:' : ''}
          </Texto>
          {p.motivo_rechazo && (
            <div className="bg-crema-2 rounded-2xl px-4 py-3">
              <Texto tamano="sm" tono="normal">
                {p.motivo_rechazo}
              </Texto>
            </div>
          )}
          <Button variant="outline" size="sm" asChild className="w-fit">
            <Link href={RUTAS.publico.publicar}>
              <Plus className="size-4" />
              Volver a pedirlo con más detalle
            </Link>
          </Button>
        </div>
      )}
    </motion.article>
  );
}
