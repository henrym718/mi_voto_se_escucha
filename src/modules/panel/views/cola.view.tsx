'use client';

import { useState } from 'react';

import { Check, Copy, Inbox, Loader2, Merge, Mic, Plus, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { haceCuanto } from '@/shared/lib/fechas';
import { cn } from '@/shared/lib/utils';

import { HojaNuevoPedido } from '../components/hoja-nuevo-pedido';
import { useAprobar, useCola, useFusionar, useRechazar } from '../hooks/use-panel';
import { usePanel } from '../panel.provider';
import { type PedidoEnCola, enlaceDeNota } from '../services/panel.service';

/**
 * La cola de revisión: el único trabajo diario del equipo.
 *
 * Cada tarjeta llega con el borrador que la IA armó a partir de lo que el
 * vecino dijo, y con lo que dijo de verdad al lado. Revisar es leer, corregir
 * una palabra si hace falta y tocar Publicar.
 *
 * Y antes de eso, la pregunta que decide si el dato sirve: ¿esto ya existe? Si
 * diez vecinos reportan que no hay agua, tienen que terminar en UNA causa con
 * diez apoyos. Por eso las parecidas van arriba, con su botón de unificar, no
 * escondidas en otra pantalla.
 */
export function ColaView() {
  const { ciudad, puedeEditar } = usePanel();
  const { data: pedidos = [], isLoading } = useCola(ciudad.id);
  const [levantando, setLevantando] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Titulo nivel="h1">Pedidos por revisar</Titulo>
          <Texto tamano="sm">
            {isLoading
              ? 'Cargando…'
              : pedidos.length === 0
                ? 'No hay nada pendiente. Todo al día.'
                : `${pedidos.length} ${pedidos.length === 1 ? 'pedido espera' : 'pedidos esperan'} tu visto bueno.`}
          </Texto>
        </div>
        {/* Lo que llega por asamblea o por teléfono entra por aquí, no por la
            base de datos. */}
        {puedeEditar && (
          <Button variant="accion" onClick={() => setLevantando(true)}>
            <Plus />
            Levantar un pedido
          </Button>
        )}
      </div>

      <HojaNuevoPedido abierta={levantando} onCerrar={() => setLevantando(false)} />

      {isLoading ? (
        <div className="flex items-center gap-2 py-12">
          <Loader2 className="text-fg-strong size-5 animate-spin" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="border-linea flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white px-6 py-16 text-center">
          <Inbox className="text-fg-faint size-8" />
          <Texto peso="fuerte" tono="normal">
            Bandeja vacía
          </Texto>
          <Texto tamano="sm">Cuando un vecino publique algo, aparecerá aquí.</Texto>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {pedidos.map((pedido) => (
              <TarjetaEnCola key={pedido.id} pedido={pedido} ciudadId={ciudad.id} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TarjetaEnCola({ pedido, ciudadId }: { pedido: PedidoEnCola; ciudadId: string }) {
  const aprobar = useAprobar(ciudadId);
  const rechazar = useRechazar(ciudadId);
  const fusionar = useFusionar(ciudadId);

  // El borrador de la IA llega segundos después de que se abrió la pantalla, y
  // la cola se refresca sola. Por eso el campo NO copia la respuesta a estado:
  // muestra lo que el equipo tecleó si tecleó algo, y si no, lo último que trajo
  // el servidor. Así el borrador aparece solo, sin recargar y sin pisar a nadie.
  const [tituloTecleado, setTituloTecleado] = useState<string | undefined>(undefined);
  const [descTecleada, setDescTecleada] = useState<string | undefined>(undefined);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const titulo = tituloTecleado ?? pedido.titulo ?? '';
  const descripcion = descTecleada ?? pedido.descripcion ?? '';

  const loQueDijo = pedido.transcripcion ?? pedido.texto_original;
  const listoParaPublicar = titulo.trim().length >= 8;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
      className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-crema-2 text-fg-muted rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold">
          {pedido.ciudadela}
        </span>
        <span className="bg-crema-2 text-fg-muted rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold">
          {pedido.categoria}
        </span>
        <span className="text-fg-subtle text-[0.75rem]">{haceCuanto(pedido.creada_en)}</span>
        <EtiquetaIA estado={pedido.ia_estado} />
      </div>

      {/* La señal que evita duplicados antes de que ocurran, con el botón que
          los resuelve en el mismo gesto. */}
      {pedido.parecidas.length > 0 && (
        <div className="border-linea bg-crema-2 flex flex-col gap-2 rounded-xl border p-3">
          <span className="text-fg-strong flex items-center gap-1.5 text-[0.8125rem] font-bold">
            <Copy className="size-3.5" />
            Ya hay algo parecido en {pedido.ciudadela}
          </span>
          {pedido.parecidas.map((otra) => (
            <div
              key={otra.id}
              className="border-linea flex flex-wrap items-center gap-2 rounded-lg border bg-white px-3 py-2"
            >
              <span className="text-fg-strong min-w-0 flex-1 text-[0.875rem] font-medium">
                {otra.titulo}
              </span>
              <span className="text-fg-subtle text-[0.75rem] font-semibold">
                {otra.parecido}% · {otra.apoyos} apoyos
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={fusionar.isPending}
                onClick={() =>
                  fusionar.mutate({ destinoId: otra.id, origenIds: [pedido.id] })
                }
              >
                <Merge className="size-3.5" />
                Unificar
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {pedido.foto_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pedido.foto_url} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* El borrador es editable en el sitio: corregir una palabra no puede
              costar abrir otra pantalla. */}
          <input
            value={titulo}
            onChange={(e) => setTituloTecleado(e.target.value)}
            placeholder={
              pedido.ia_estado === 'pendiente'
                ? 'La IA está ordenando el pedido…'
                : 'Escribe el título de la causa'
            }
            maxLength={120}
            className="border-linea focus:border-tinta text-fg-strong h-11 w-full rounded-lg border px-3 text-[1rem] font-semibold outline-none transition-colors"
          />
          <textarea
            value={descripcion}
            onChange={(e) => setDescTecleada(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Descripción en una o dos frases"
            className="border-linea focus:border-tinta w-full resize-none rounded-lg border px-3 py-2 text-[0.875rem] outline-none transition-colors"
          />
        </div>
      </div>

      {/* Lo que el vecino dijo de verdad, siempre visible junto al borrador: es
          la única forma de darse cuenta si el modelo entendió otra cosa. */}
      {(loQueDijo || pedido.audio_url) && (
        <div className="border-linea flex flex-col gap-2 rounded-xl border border-dashed p-3">
          <span className="text-fg-subtle text-[0.6875rem] font-bold tracking-wide uppercase">
            Lo que dijo el vecino
          </span>
          {loQueDijo && (
            <Texto tamano="sm" className="italic">
              «{loQueDijo}»
            </Texto>
          )}
          {pedido.audio_url && <Reproductor ruta={pedido.audio_url} />}
        </div>
      )}

      {rechazando ? (
        <div className="border-linea bg-crema-2 flex flex-col gap-2 rounded-xl border p-3">
          <Texto tamano="xs" peso="fuerte" tono="normal">
            ¿Por qué se descarta? Queda registrado en la bitácora.
          </Texto>
          <input
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Duplicado del pedido de la calle 4"
            className="border-linea focus:border-tinta h-11 w-full rounded-lg border bg-white px-3 text-[0.875rem] outline-none"
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRechazando(false);
                setMotivo('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={motivo.trim().length < 5 || rechazar.isPending}
              onClick={async () => {
                await rechazar.mutateAsync({ obraId: pedido.id, motivo: motivo.trim() });
                setRechazando(false);
                setMotivo('');
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="institucional"
            disabled={!listoParaPublicar || aprobar.isPending}
            onClick={() =>
              aprobar.mutate({
                obraId: pedido.id,
                titulo: titulo.trim(),
                descripcion: descripcion.trim(),
              })
            }
            className="flex-1"
          >
            <Check />
            Publicar
          </Button>
          <Button variant="outline" onClick={() => setRechazando(true)}>
            <X />
            Descartar
          </Button>
        </div>
      )}
    </motion.article>
  );
}

function EtiquetaIA({ estado }: { estado: PedidoEnCola['ia_estado'] }) {
  if (estado === 'no_aplica') return null;

  const estilos = {
    pendiente: { texto: 'Ordenando con IA…', clase: 'bg-crema-2 text-fg-muted' },
    listo: { texto: 'Borrador de IA', clase: 'bg-crema-2 text-fg-strong' },
    fallido: { texto: 'Redáctalo tú', clase: 'bg-arena text-alerta' },
  }[estado];

  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold',
        estilos.clase,
      )}
    >
      {estado === 'pendiente' ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Sparkles className="size-3" />
      )}
      {estilos.texto}
    </span>
  );
}

/**
 * La nota de voz. El enlace se pide al tocar, no al pintar la lista: firmarlo
 * cuesta un viaje por pedido y en una cola de treinta casi ninguno se escucha.
 */
function Reproductor({ ruta }: { ruta: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  if (url) {
    // El navegador pone sus propios controles; no hay pista de subtítulos que dar.
    return <audio src={url} controls autoPlay className="h-10 w-full" />;
  }

  return (
    <button
      type="button"
      disabled={cargando}
      onClick={async () => {
        setCargando(true);
        setUrl(await enlaceDeNota(ruta));
        setCargando(false);
      }}
      className="border-linea text-fg-strong hover:bg-crema-2 flex min-h-10 w-fit items-center gap-2 rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors"
    >
      {cargando ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
      Escuchar la nota de voz
    </button>
  );
}
