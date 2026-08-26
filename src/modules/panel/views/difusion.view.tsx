'use client';

import { useState } from 'react';

import { AlertTriangle, Loader2, Send, Users } from 'lucide-react';
import { motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { useCategorias, useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';
import { cifra, cn } from '@/shared/lib/utils';

import { useDifundir } from '../hooks/use-panel';
import { usePanel } from '../panel.provider';

/**
 * Difusión segmentada. La simulación va antes del envío a propósito: nadie
 * debería mandar mil mensajes sin ver primero a cuántos llega y qué cuesta.
 *
 * El tope semanal no se puede desactivar desde aquí. Si el equipo pudiera
 * saltárselo con un botón, se lo saltaría en la primera semana de campaña, los
 * vecinos bloquearían el número, y el padrón que se vende dejaría de valer.
 */
export function DifusionView() {
  const { ciudad } = usePanel();
  const [mensaje, setMensaje] = useState('');
  const [barrios, setBarrios] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [simulacion, setSimulacion] = useState<{
    alcance: number;
    frenados: number;
    costo: number;
  } | null>(null);

  const { data: ciudadelas = [] } = useCiudadelas(ciudad.id);
  const { data: cats = [] } = useCategorias(ciudad.id);
  const difundir = useDifundir();

  const mensajeValido = mensaje.trim().length >= 10;

  async function simular() {
    const r = await difundir.mutateAsync({
      ciudadId: ciudad.id,
      mensaje: mensaje.trim(),
      ciudadelaIds: barrios.length > 0 ? barrios : null,
      categoriaIds: categorias.length > 0 ? categorias : null,
      simular: true,
    });
    if (r.success && r.simulacion) {
      setSimulacion({
        alcance: r.alcance ?? 0,
        frenados: r.frenados_por_tope ?? 0,
        costo: r.costo_estimado ?? 0,
      });
    }
  }

  async function enviar() {
    const r = await difundir.mutateAsync({
      ciudadId: ciudad.id,
      mensaje: mensaje.trim(),
      ciudadelaIds: barrios.length > 0 ? barrios : null,
      categoriaIds: categorias.length > 0 ? categorias : null,
    });
    if (r.success && !r.simulacion) {
      setMensaje('');
      setSimulacion(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Titulo nivel="h1">Difusión por WhatsApp</Titulo>
        <Texto tamano="sm">
          Un mensaje a los vecinos verificados. Se puede acotar por barrio y por lo que a cada
          uno le interesa.
        </Texto>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="mensaje" className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
          Mensaje
        </label>
        <textarea
          id="mensaje"
          rows={4}
          value={mensaje}
          onChange={(e) => {
            setMensaje(e.target.value.slice(0, 600));
            setSimulacion(null);
          }}
          placeholder="Este sábado a las 10 de la mañana el candidato recorre tu sector. Te esperamos en la cancha central."
          className="border-linea focus:border-teal focus:ring-teal/20 w-full resize-none rounded-xl border bg-white px-4 py-3 text-[0.9375rem] outline-none transition-all focus:ring-3"
        />
        <Texto tamano="xs" tono="tenue" className="cifra self-end">
          {mensaje.length}/600
        </Texto>
      </div>

      <SelectorMultiple
        titulo="Ciudadelas"
        vacio="Todas las ciudadelas"
        opciones={ciudadelas.map((c) => ({ id: c.id, nombre: c.nombre }))}
        elegidos={barrios}
        onCambiar={(v) => {
          setBarrios(v);
          setSimulacion(null);
        }}
      />

      <SelectorMultiple
        titulo="Interés"
        vacio="Cualquier interés"
        ayuda="Llega solo a quienes apoyaron alguna obra de estas categorías."
        opciones={cats.map((c) => ({ id: c.id, nombre: c.nombre }))}
        elegidos={categorias}
        onCambiar={(v) => {
          setCategorias(v);
          setSimulacion(null);
        }}
      />

      {simulacion && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4"
        >
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="cifra text-teal text-[2rem] leading-none font-extrabold">
                {cifra(simulacion.alcance)}
              </span>
              <Texto tamano="xs">vecinos recibirán el mensaje</Texto>
            </div>
            <div className="bg-linea h-10 w-px" />
            <div className="flex flex-col">
              <span className="cifra text-fg-strong text-[1.5rem] leading-none font-bold">
                ${simulacion.costo.toFixed(2)}
              </span>
              <Texto tamano="xs">costo estimado</Texto>
            </div>
          </div>

          {simulacion.frenados > 0 && (
            <div className="bg-arena flex items-start gap-2.5 rounded-xl px-3.5 py-2.5">
              <AlertTriangle className="text-alerta mt-0.5 size-4 shrink-0" />
              <Texto tamano="xs" tono="normal">
                <strong>{cifra(simulacion.frenados)}</strong> vecinos quedan fuera porque ya
                recibieron dos difusiones esta semana. Es a propósito: es lo que evita que la
                gente bloquee el número.
              </Texto>
            </div>
          )}
        </motion.div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="lg"
          disabled={!mensajeValido || difundir.isPending}
          onClick={() => void simular()}
        >
          {difundir.isPending ? <Loader2 className="animate-spin" /> : <Users />}
          Ver a cuántos llega
        </Button>
        <Button
          variant="accion"
          size="lg"
          disabled={!mensajeValido || !simulacion || simulacion.alcance === 0 || difundir.isPending}
          onClick={() => void enviar()}
        >
          <Send />
          Enviar a {simulacion ? cifra(simulacion.alcance) : '…'} vecinos
        </Button>
      </div>

      <Texto tamano="xs" tono="tenue">
        Los avisos de las obras que cada vecino apoyó no cuentan contra el tope semanal: esos
        siempre llegan, porque los pidió él.
      </Texto>
    </div>
  );
}

function SelectorMultiple({
  titulo,
  vacio,
  ayuda,
  opciones,
  elegidos,
  onCambiar,
}: {
  titulo: string;
  vacio: string;
  ayuda?: string;
  opciones: { id: string; nombre: string }[];
  elegidos: string[];
  onCambiar: (v: string[]) => void;
}) {
  const [verTodas, setVerTodas] = useState(false);
  const visibles = verTodas ? opciones : opciones.slice(0, 12);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col">
        <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
          {titulo}
        </span>
        {ayuda && (
          <Texto tamano="xs" tono="tenue">
            {ayuda}
          </Texto>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onCambiar([])}
          className={cn(
            'min-h-9 rounded-full px-3.5 text-[0.8125rem] font-medium transition-all',
            elegidos.length === 0
              ? 'bg-teal text-white'
              : 'border-linea text-fg-muted border bg-white',
          )}
        >
          {vacio}
        </button>
        {visibles.map((o) => {
          const activo = elegidos.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() =>
                onCambiar(activo ? elegidos.filter((e) => e !== o.id) : [...elegidos, o.id])
              }
              className={cn(
                'min-h-9 rounded-full px-3.5 text-[0.8125rem] font-medium transition-all active:scale-95',
                activo ? 'bg-teal text-white' : 'border-linea text-fg-muted border bg-white',
              )}
            >
              {o.nombre}
            </button>
          );
        })}
        {opciones.length > 12 && (
          <button
            type="button"
            onClick={() => setVerTodas((v) => !v)}
            className="text-teal min-h-9 px-2 text-[0.8125rem] font-semibold"
          >
            {verTodas ? 'Ver menos' : `Ver las ${opciones.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
