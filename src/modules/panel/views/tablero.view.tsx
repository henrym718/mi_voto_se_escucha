'use client';

import { useMemo, useRef, useState } from 'react';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { AlertTriangle, Film, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { useCategorias, useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';
import { cifra, cn } from '@/shared/lib/utils';

import { HojaCambioEstado } from '../components/hoja-cambio-estado';
import { useTablero } from '../hooks/use-panel';
import type { ColumnaTablero, TarjetaTablero } from '../services/panel.service';

interface Props {
  ciudadId: string;
  puedeEditar: boolean;
}

/**
 * El tablero. Las columnas NO están en el código: son los estados que cada
 * ciudad configuró, así que un cliente en modo campaña y otro en modo gestión
 * ven tableros distintos sin que cambie una línea.
 *
 * Arrastrar una tarjeta no mueve nada por sí solo: abre la hoja para escribir
 * el mensaje y adjuntar foto o video. El movimiento y el aviso a los vecinos
 * salen juntos o no salen.
 */
export function TableroView({ ciudadId, puedeEditar }: Props) {
  const [ciudadelaId, setCiudadelaId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<TarjetaTablero | null>(null);
  const [movimiento, setMovimiento] = useState<{
    obra: TarjetaTablero;
    desde: ColumnaTablero;
    hacia: ColumnaTablero;
  } | null>(null);

  const { data: columnas = [], isLoading } = useTablero(ciudadId, { ciudadelaId, categoriaId });
  const { data: ciudadelas = [] } = useCiudadelas(ciudadId);
  const { data: categorias = [] } = useCategorias(ciudadId);

  const sensores = useSensors(
    // Un poco de recorrido antes de activar: en móvil, sin esto, cualquier
    // desplazamiento del dedo arranca un arrastre por accidente.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const porId = useMemo(() => {
    const mapa = new Map<string, { obra: TarjetaTablero; columna: ColumnaTablero }>();
    columnas.forEach((c) => c.obras.forEach((o) => mapa.set(o.id, { obra: o, columna: c })));
    return mapa;
  }, [columnas]);

  function alEmpezar(e: DragStartEvent) {
    const encontrado = porId.get(String(e.active.id));
    if (encontrado) setArrastrando(encontrado.obra);
  }

  function alSoltar(e: DragEndEvent) {
    setArrastrando(null);
    const destino = e.over?.id ? String(e.over.id) : null;
    const encontrado = porId.get(String(e.active.id));
    if (!destino || !encontrado) return;
    if (destino === encontrado.columna.id) return;

    const columnaDestino = columnas.find((c) => c.id === destino);
    if (!columnaDestino) return;

    setMovimiento({ obra: encontrado.obra, desde: encontrado.columna, hacia: columnaDestino });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Titulo nivel="h1">Tablero de obras</Titulo>
          <Texto tamano="sm">
            {puedeEditar
              ? 'Arrastra una obra a otra columna para publicar el avance y avisar a quienes la apoyaron.'
              : 'Vista de solo lectura. Para mover obras necesitas permiso de edición.'}
          </Texto>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Filtro
          etiqueta="Todas las ciudadelas"
          opciones={ciudadelas.map((c) => ({ id: c.id, nombre: c.nombre }))}
          elegido={ciudadelaId}
          onElegir={setCiudadelaId}
        />
        <Filtro
          etiqueta="Todas las categorías"
          opciones={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
          elegido={categoriaId}
          onElegir={setCategoriaId}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-16">
          <Loader2 className="text-teal size-5 animate-spin" />
          <Texto tamano="sm">Cargando el tablero…</Texto>
        </div>
      ) : (
        <DndContext sensors={sensores} onDragStart={alEmpezar} onDragEnd={alSoltar}>
          <Desplazable>
            {columnas.map((columna) => (
              <Columna key={columna.id} columna={columna} puedeEditar={puedeEditar} />
            ))}
          </Desplazable>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
            {arrastrando && (
              <div className="border-teal w-[17rem] rotate-2 rounded-xl border-2 bg-white p-3 shadow-lg">
                <Tarjeta obra={arrastrando} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <AnimatePresence>
        {movimiento && (
          <HojaCambioEstado
            ciudadId={ciudadId}
            obra={movimiento.obra}
            desde={movimiento.desde}
            hacia={movimiento.hacia}
            onCerrar={() => setMovimiento(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * La zona de desplazamiento del tablero. Hace tres cosas que el `overflow-auto`
 * pelado de antes no hacía:
 *
 * 1. Ocupa TODO el ancho de la zona de contenido. Las demás pantallas se leen
 *    mejor con un ancho máximo, pero un kanban con ese tope desperdicia media
 *    pantalla en un monitor y esconde una columna que cabría. El `100cqw` mide
 *    el `<main>` del panel, así que la barra lateral no entra en la cuenta.
 *
 * 2. Enseña la barra de desplazamiento. Estaba oculta con `sin-barra`: en un
 *    teléfono da igual porque se arrastra con el dedo, pero en un PC el tablero
 *    aparecía cortado por la izquierda sin ninguna pista de que había más y de
 *    cómo volver.
 *
 * 3. Se pasea arrastrando con el ratón, como cualquier kanban. Solo agarra
 *    fuera de una tarjeta —encima de una manda dnd-kit— y solo con ratón: en
 *    táctil el desplazamiento nativo ya funciona y capturar el puntero se lo
 *    quitaría.
 */
function Desplazable({ children }: { children: React.ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  const paneo = useRef({ activo: false, desdeX: 0, desdeScroll: 0 });
  const [agarrando, setAgarrando] = useState(false);

  function alPresionar(e: React.PointerEvent<HTMLDivElement>) {
    const el = caja.current;
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-arrastrable="true"]')) return;

    paneo.current = { activo: true, desdeX: e.clientX, desdeScroll: el.scrollLeft };
    setAgarrando(true);
    el.setPointerCapture(e.pointerId);
  }

  function alMover(e: React.PointerEvent<HTMLDivElement>) {
    if (!paneo.current.activo || !caja.current) return;
    caja.current.scrollLeft = paneo.current.desdeScroll - (e.clientX - paneo.current.desdeX);
  }

  function alSoltar(e: React.PointerEvent<HTMLDivElement>) {
    if (!paneo.current.activo) return;
    paneo.current.activo = false;
    setAgarrando(false);
    caja.current?.releasePointerCapture(e.pointerId);
  }

  return (
    <div
      ref={caja}
      onPointerDown={alPresionar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      style={{ marginInline: 'calc((100% - 100cqw) / 2)', width: '100cqw' }}
      className={cn(
        'barra-tablero flex gap-3 overflow-x-auto px-4 pb-3 md:px-8',
        agarrando ? 'cursor-grabbing select-none' : 'cursor-grab',
      )}
    >
      {children}
    </div>
  );
}

function Columna({ columna, puedeEditar }: { columna: ColumnaTablero; puedeEditar: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: columna.id, disabled: !puedeEditar });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-[17.5rem] shrink-0 flex-col gap-2.5 rounded-2xl p-2.5 transition-colors',
        isOver ? 'bg-teal-pastel/70 ring-teal ring-2' : 'bg-crema-2',
      )}
    >
      <div className="flex items-center gap-2 px-1.5 pt-1">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: columna.color }}
        />
        <span className="text-fg-strong truncate text-[0.875rem] font-bold">{columna.nombre}</span>
        <span className="cifra text-fg-muted ml-auto rounded-full bg-white px-2 py-0.5 text-[0.7rem] font-bold">
          {columna.total}
        </span>
      </div>

      {columna.es_cierre_suave && (
        <Texto tamano="xs" tono="tenue" className="px-1.5">
          Cierre sin costo político
        </Texto>
      )}

      <div className="flex min-h-24 flex-col gap-2">
        {columna.obras.map((obra) => (
          <TarjetaArrastrable key={obra.id} obra={obra} puedeEditar={puedeEditar} />
        ))}

        {columna.obras.length === 0 && (
          <div
            className={cn(
              'flex items-center justify-center rounded-xl border border-dashed py-8 transition-colors',
              isOver ? 'border-teal' : 'border-linea',
            )}
          >
            <Texto tamano="xs" tono="tenue">
              {isOver ? 'Soltar aquí' : 'Sin obras'}
            </Texto>
          </div>
        )}
      </div>
    </div>
  );
}

function TarjetaArrastrable({ obra, puedeEditar }: { obra: TarjetaTablero; puedeEditar: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: obra.id,
    disabled: !puedeEditar,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // Se lo mira el desplazamiento por arrastre del tablero para apartarse:
      // encima de una tarjeta manda dnd-kit, no el paneo.
      data-arrastrable="true"
      className={cn(
        'border-linea rounded-xl border bg-white p-3 transition-opacity',
        puedeEditar && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
    >
      <Tarjeta obra={obra} />
    </div>
  );
}

function Tarjeta({ obra }: { obra: TarjetaTablero }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-fg-strong text-[0.875rem] leading-snug font-semibold">
        {obra.titulo}
      </span>
      <span className="text-fg-subtle text-[0.7rem]">
        {obra.ciudadela} · {obra.categoria}
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="cifra text-teal text-[0.8125rem] font-bold">{cifra(obra.apoyos)}</span>
        <div className="flex items-center gap-1.5">
          {obra.tiene_media && <Film className="text-fg-faint size-3.5" />}
          {/* La señal que le dice al equipo dónde está quedando mal. */}
          {obra.dias_sin_cambio >= 30 && (
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold',
                obra.dias_sin_cambio >= 60
                  ? 'bg-peligro-pastel text-peligro'
                  : 'bg-arena text-alerta',
              )}
            >
              <AlertTriangle className="size-2.5" />
              {obra.dias_sin_cambio}d
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Filtro({
  etiqueta,
  opciones,
  elegido,
  onElegir,
}: {
  etiqueta: string;
  opciones: { id: string; nombre: string }[];
  elegido: string | null;
  onElegir: (id: string | null) => void;
}) {
  return (
    <select
      value={elegido ?? ''}
      onChange={(e) => onElegir(e.target.value || null)}
      className="border-linea focus:border-teal h-10 rounded-xl border bg-white px-3 text-[0.8125rem] font-medium outline-none"
    >
      <option value="">{etiqueta}</option>
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
    </select>
  );
}
