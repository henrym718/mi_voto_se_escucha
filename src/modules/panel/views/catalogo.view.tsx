'use client';

import { useState } from 'react';

import {
  ChevronDown,
  CloudRain,
  Droplets,
  Footprints,
  Lightbulb,
  Loader2,
  MapPin,
  Plus,
  RotateCcw,
  Route,
  Save,
  Shield,
  Tractor,
  Trash2,
  Trees,
  TriangleAlert,
  Waves,
  Wrench,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';

import {
  useCatalogoDelPanel,
  useGuardarCategorias,
  useGuardarCiudadelas,
} from '../hooks/use-panel';
import { usePanel } from '../panel.provider';
import type { CategoriaDelCatalogo, SectorDelCatalogo } from '../services/panel.service';

/**
 * El catálogo del cantón: los sectores y los tipos de obra.
 *
 * Es la pantalla que evita el ticket. Quien camina el barrio es quien descubre
 * que falta la lotización nueva o que el sector se llama distinto de lo que
 * decía el documento municipal, y hasta aquí eso solo se arreglaba entrando a
 * la base de datos.
 *
 * Nada se borra: quitar de la lista desactiva. Detrás de un sector hay obras,
 * apoyos y el padrón de vecinos de ese barrio, y por eso cada fila enseña
 * cuánto cuelga de ella antes de que alguien la apague.
 */
export function CatalogoView() {
  const { ciudad, puedeEditar } = usePanel();
  const [pestana, setPestana] = useState<'sectores' | 'categorias'>('sectores');
  const catalogo = useCatalogoDelPanel(ciudad.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Titulo nivel="h1">Catálogo del cantón</Titulo>
        <Texto tamano="sm">
          Los sectores entre los que el vecino elige al publicar y los tipos de obra con los que se
          clasifica lo que pide. Es la lista cerrada de {ciudad.nombre}: nadie escribe texto libre
          sobre ella.
        </Texto>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['sectores', 'Sectores y ciudadelas'],
            ['categorias', 'Categorías de obra'],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPestana(id)}
            className={cn(
              'min-h-11 rounded-full px-5 text-[0.875rem] font-semibold transition-all active:translate-y-px',
              pestana === id
                ? 'bg-tinta text-white'
                : 'border-linea hover:border-tinta border bg-white',
            )}
          >
            {texto}
          </button>
        ))}
      </div>

      {!puedeEditar && (
        <div className="bg-crema-2 rounded-2xl px-4 py-3">
          <Texto tamano="sm" tono="normal">
            Tu cuenta es de solo lectura: puedes mirar el catálogo, pero no guardarlo.
          </Texto>
        </div>
      )}

      {catalogo.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="text-fg-muted size-6 animate-spin" />
        </div>
      ) : pestana === 'sectores' ? (
        <EditorSectores
          inicial={catalogo.data?.ciudadelas ?? []}
          ciudadId={ciudad.id}
          puedeEditar={puedeEditar}
        />
      ) : (
        <EditorCategorias
          inicial={catalogo.data?.categorias ?? []}
          ciudadId={ciudad.id}
          puedeEditar={puedeEditar}
        />
      )}
    </div>
  );
}

/* ================================================================ sectores == */

type SectorEditable = Omit<SectorDelCatalogo, 'id'> & { id?: string };

const ZONAS = [
  { id: 'urbana', etiqueta: 'Urbana', ayuda: 'Ciudadela o barrio dentro de la ciudad' },
  { id: 'rural', etiqueta: 'Rural', ayuda: 'Recinto o comuna fuera del casco urbano' },
  {
    id: 'funcional',
    etiqueta: 'De uso corriente',
    ayuda: 'Nombre que usa la gente, ej. «el Centro»',
  },
] as const;

function EditorSectores({
  inicial,
  ciudadId,
  puedeEditar,
}: {
  inicial: SectorDelCatalogo[];
  ciudadId: string;
  puedeEditar: boolean;
}) {
  const guardar = useGuardarCiudadelas(ciudadId);

  const [sectores, setSectores] = useState<SectorEditable[]>(inicial);
  const [tocado, setTocado] = useState(false);
  const [cargadoDe, setCargadoDe] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

  // Mismo patrón que el editor de estados: se siembra durante el render y se
  // deja de sincronizar en cuanto el equipo toca algo, para no pisarle lo que
  // está escribiendo cuando la consulta se refresca sola.
  const firma = inicial.map((s) => s.id).join(',');
  if (inicial.length > 0 && cargadoDe !== firma && !tocado) {
    setCargadoDe(firma);
    setSectores(inicial);
  }

  function actualizar(indice: number, cambios: Partial<SectorEditable>) {
    setTocado(true);
    setSectores((prev) => prev.map((s, i) => (i === indice ? { ...s, ...cambios } : s)));
  }

  const activos = sectores.filter((s) => s.activa);
  const apagados = sectores.filter((s) => !s.activa);

  const termino = busqueda.trim().toLowerCase();
  const coincide = (s: SectorEditable) => !termino || s.nombre.toLowerCase().includes(termino);

  const sinNombre = activos.some((s) => s.nombre.trim().length < 3);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Busca un sector…"
          className="border-linea focus:border-tinta h-11 min-w-0 flex-1 rounded-xl border bg-white px-4 text-base transition-all outline-none focus:ring-3"
        />
        <Texto tamano="sm" tono="tenue">
          {activos.length} activos
          {apagados.length > 0 ? ` · ${apagados.length} apagados` : ''}
        </Texto>
      </div>

      {/* El buscador solo filtra lo que se ve. Lo que se guarda es la lista
          entera, y por eso hace falta decirlo: si no, quien filtra y aprieta
          guardar cree que acaba de borrar todo lo demás. */}
      {termino && (
        <Texto tamano="xs" tono="tenue">
          Estás viendo solo lo que coincide con «{busqueda.trim()}». Al guardar se manda la lista
          completa, no solo esto.
        </Texto>
      )}

      {/* Sin AnimatePresence a propósito, al revés que en las demás listas del
          panel: un cantón trae setenta y pico sectores, y escribir una letra en
          el buscador dispararía setenta animaciones de salida a la vez. Las
          filas se quitan y ya. */}
      <div className="flex flex-col gap-2">
        {sectores.map((sector, i) =>
          !sector.activa || !coincide(sector) ? null : (
            <div
              key={sector.id ?? `nuevo-${i}`}
              className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-3.5"
            >
              <div className="flex items-center gap-2">
                <MapPin className="text-fg-faint size-4 shrink-0" />
                <input
                  value={sector.nombre}
                  onChange={(e) => actualizar(i, { nombre: e.target.value.slice(0, 80) })}
                  disabled={!puedeEditar}
                  placeholder="Nombre del sector"
                  className="border-linea focus:border-tinta h-11 min-w-0 flex-1 rounded-xl border px-3 text-[0.9375rem] font-semibold outline-none disabled:bg-transparent"
                />
                <button
                  type="button"
                  onClick={() =>
                    setAbierto(
                      abierto === (sector.id ?? `nuevo-${i}`) ? null : (sector.id ?? `nuevo-${i}`),
                    )
                  }
                  aria-label="Ver detalles"
                  className="text-fg-faint hover:text-fg-default flex size-9 shrink-0 items-center justify-center rounded-xl"
                >
                  <ChevronDown
                    className={cn(
                      'size-4 transition-transform',
                      abierto === (sector.id ?? `nuevo-${i}`) && 'rotate-180',
                    )}
                  />
                </button>
                {puedeEditar && (
                  <button
                    type="button"
                    onClick={() => actualizar(i, { activa: false })}
                    aria-label="Quitar sector"
                    className="text-fg-faint hover:text-peligro flex size-9 shrink-0 items-center justify-center rounded-xl"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {ZONAS.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    disabled={!puedeEditar}
                    onClick={() => actualizar(i, { zona: z.id })}
                    title={z.ayuda}
                    className={cn(
                      'min-h-8 rounded-full px-3 text-[0.75rem] font-semibold transition-colors',
                      sector.zona === z.id
                        ? 'bg-tinta text-white'
                        : 'border-linea text-fg-subtle border',
                    )}
                  >
                    {z.etiqueta}
                  </button>
                ))}

                {sector.id && (
                  <Texto tamano="xs" tono="tenue" className="ml-auto">
                    {cuenta(sector.obras, 'obra')} · {cuenta(sector.vecinos, 'vecino')}
                  </Texto>
                )}
              </div>

              {abierto === (sector.id ?? `nuevo-${i}`) && (
                <div className="border-linea flex flex-col gap-3 border-t pt-3">
                  <Campo etiqueta="Enlace del canal de WhatsApp">
                    <input
                      value={sector.enlace_canal ?? ''}
                      onChange={(e) => actualizar(i, { enlace_canal: e.target.value })}
                      disabled={!puedeEditar}
                      placeholder="https://chat.whatsapp.com/…"
                      className="border-linea focus:border-tinta h-11 w-full rounded-xl border px-3 text-[0.875rem] outline-none"
                    />
                  </Campo>

                  <div className="flex flex-wrap gap-3">
                    <Campo etiqueta="Población estimada">
                      <input
                        inputMode="numeric"
                        value={sector.poblacion_estimada ?? ''}
                        onChange={(e) =>
                          actualizar(i, {
                            poblacion_estimada: e.target.value.replace(/\D/g, '')
                              ? Number(e.target.value.replace(/\D/g, ''))
                              : null,
                          })
                        }
                        disabled={!puedeEditar}
                        placeholder="850"
                        className="border-linea focus:border-tinta h-11 w-32 rounded-xl border px-3 text-[0.875rem] outline-none"
                      />
                    </Campo>

                    <Campo etiqueta="De dónde salió el nombre">
                      <input
                        value={sector.fuente ?? ''}
                        onChange={(e) => actualizar(i, { fuente: e.target.value.slice(0, 200) })}
                        disabled={!puedeEditar}
                        placeholder="Ordenanza municipal, recorrido…"
                        className="border-linea focus:border-tinta h-11 w-full min-w-48 rounded-xl border px-3 text-[0.875rem] outline-none"
                      />
                    </Campo>
                  </div>

                  <button
                    type="button"
                    disabled={!puedeEditar}
                    onClick={() => actualizar(i, { verificado: !sector.verificado })}
                    className={cn(
                      'flex min-h-9 w-fit flex-col items-start rounded-xl px-3 py-1.5 text-left transition-colors',
                      sector.verificado ? 'bg-tinta text-white' : 'bg-crema-2 text-fg-subtle',
                    )}
                  >
                    <span className="text-[0.75rem] font-bold">
                      {sector.verificado ? 'Verificado' : 'Por verificar'}
                    </span>
                    <span className="text-[0.65rem] opacity-75">
                      Confirmado con documento municipal
                    </span>
                  </button>
                </div>
              )}
            </div>
          ),
        )}

        {puedeEditar && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setTocado(true);
              setBusqueda('');
              setSectores((prev) => [
                ...prev,
                {
                  nombre: '',
                  slug: '',
                  zona: 'urbana',
                  verificado: false,
                  fuente: null,
                  poblacion_estimada: null,
                  enlace_canal: null,
                  orden: prev.length + 1,
                  activa: true,
                  obras: 0,
                  vecinos: 0,
                },
              ]);
            }}
          >
            <Plus />
            Agregar sector
          </Button>
        )}
      </div>

      {apagados.length > 0 && (
        <div className="flex flex-col gap-2">
          <Texto tamano="sm" peso="fuerte" tono="normal">
            Apagados
          </Texto>
          <Texto tamano="xs" tono="tenue">
            No aparecen al publicar ni en los filtros, pero sus obras y sus vecinos siguen ahí.
            Volver a encenderlos lo recupera todo.
          </Texto>
          <div className="flex flex-col gap-1.5">
            {sectores.map((sector, i) =>
              sector.activa ? null : (
                <div
                  key={sector.id ?? `apagado-${i}`}
                  className="border-linea flex items-center gap-2 rounded-xl border border-dashed px-3 py-2"
                >
                  <Texto tamano="sm" tono="tenue" className="min-w-0 flex-1 truncate">
                    {sector.nombre}
                    {sector.id
                      ? ` · ${cuenta(sector.obras, 'obra')} · ${cuenta(sector.vecinos, 'vecino')}`
                      : ''}
                  </Texto>
                  {puedeEditar && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => actualizar(i, { activa: true })}
                    >
                      <RotateCcw />
                      Encender
                    </Button>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {puedeEditar && (
        <BarraGuardar
          deshabilitado={guardar.isPending || sinNombre || activos.length === 0}
          cargando={guardar.isPending}
          aviso={
            activos.length === 0
              ? 'Deja al menos un sector encendido.'
              : sinNombre
                ? 'Hay un sector sin nombre.'
                : null
          }
          onGuardar={() =>
            guardar.mutate(
              activos.map((s, i) => ({
                id: s.id,
                nombre: s.nombre.trim(),
                zona: s.zona,
                verificado: s.verificado,
                fuente: s.fuente,
                poblacion_estimada: s.poblacion_estimada,
                enlace_canal: s.enlace_canal,
                orden: i + 1,
                activa: true,
              })),
            )
          }
          etiqueta="Guardar sectores"
        />
      )}
    </div>
  );
}

/* ============================================================== categorías == */

type CategoriaEditable = Omit<CategoriaDelCatalogo, 'id'> & { id?: string };

// Los iconos que ya usa el cantón, más un par de sobra. Se enseñan dibujados y
// no por su nombre: nadie elige bien entre «route» y «footprints» leyéndolos.
const ICONOS = {
  'cloud-rain': CloudRain,
  waves: Waves,
  route: Route,
  droplets: Droplets,
  footprints: Footprints,
  'trash-2': Trash2,
  trees: Trees,
  lightbulb: Lightbulb,
  shield: Shield,
  tractor: Tractor,
  wrench: Wrench,
  'triangle-alert': TriangleAlert,
} as const;

const COLORES = [
  '#2f6fb5',
  '#0d7d6c',
  '#8a6a3d',
  '#2596be',
  '#5c7a4a',
  '#3f8f5b',
  '#c98a12',
  '#a4443c',
  '#7a6a9a',
];

function EditorCategorias({
  inicial,
  ciudadId,
  puedeEditar,
}: {
  inicial: CategoriaDelCatalogo[];
  ciudadId: string;
  puedeEditar: boolean;
}) {
  const guardar = useGuardarCategorias(ciudadId);

  const [categorias, setCategorias] = useState<CategoriaEditable[]>(inicial);
  const [tocado, setTocado] = useState(false);
  const [cargadoDe, setCargadoDe] = useState<string | null>(null);

  const firma = inicial.map((c) => c.id).join(',');
  if (inicial.length > 0 && cargadoDe !== firma && !tocado) {
    setCargadoDe(firma);
    setCategorias(inicial);
  }

  function actualizar(indice: number, cambios: Partial<CategoriaEditable>) {
    setTocado(true);
    setCategorias((prev) => prev.map((c, i) => (i === indice ? { ...c, ...cambios } : c)));
  }

  const activas = categorias.filter((c) => c.activa);
  const sinNombre = activas.some((c) => c.nombre.trim().length < 3);

  return (
    <div className="flex flex-col gap-4">
      <Texto tamano="sm">
        El orden manda: es el que ve el vecino al publicar, y conviene que arriba esté lo que más le
        duele al cantón, no lo que caiga alfabéticamente.
      </Texto>

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {categorias.map((categoria, i) => {
            const Icono = ICONOS[categoria.icono as keyof typeof ICONOS] ?? Wrench;
            return !categoria.activa ? null : (
              <motion.div
                key={categoria.id ?? `nueva-${i}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${categoria.color}1a`, color: categoria.color }}
                  >
                    <Icono className="size-4" />
                  </span>
                  <input
                    value={categoria.nombre}
                    onChange={(e) => actualizar(i, { nombre: e.target.value.slice(0, 60) })}
                    disabled={!puedeEditar}
                    placeholder="Nombre de la categoría"
                    className="border-linea focus:border-tinta h-11 min-w-0 flex-1 rounded-xl border px-3 text-[0.9375rem] font-semibold outline-none disabled:bg-transparent"
                  />
                  {categoria.id && (
                    <Texto tamano="xs" tono="tenue" className="shrink-0">
                      {cuenta(categoria.obras, 'obra')}
                    </Texto>
                  )}
                  {puedeEditar && (
                    <button
                      type="button"
                      onClick={() => actualizar(i, { activa: false })}
                      aria-label="Quitar categoría"
                      className="text-fg-faint hover:text-peligro flex size-9 shrink-0 items-center justify-center rounded-xl"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {Object.entries(ICONOS).map(([nombre, Dibujo]) => (
                    <button
                      key={nombre}
                      type="button"
                      disabled={!puedeEditar}
                      onClick={() => actualizar(i, { icono: nombre })}
                      aria-label={`Icono ${nombre}`}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg transition-colors',
                        categoria.icono === nombre
                          ? 'bg-tinta text-white'
                          : 'border-linea text-fg-subtle border',
                      )}
                    >
                      <Dibujo className="size-3.5" />
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {COLORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={!puedeEditar}
                      onClick={() => actualizar(i, { color: c })}
                      aria-label={`Color ${c}`}
                      className={cn(
                        'size-7 rounded-full transition-transform',
                        categoria.color === c ? 'ring-tinta scale-110 ring-2 ring-offset-2' : '',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {puedeEditar && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setTocado(true);
              setCategorias((prev) => [
                ...prev,
                {
                  nombre: '',
                  slug: '',
                  icono: 'wrench',
                  color: COLORES[prev.length % COLORES.length],
                  orden: prev.length + 1,
                  activa: true,
                  obras: 0,
                },
              ]);
            }}
          >
            <Plus />
            Agregar categoría
          </Button>
        )}
      </div>

      {categorias.some((c) => !c.activa) && (
        <div className="flex flex-col gap-2">
          <Texto tamano="sm" peso="fuerte" tono="normal">
            Apagadas
          </Texto>
          <Texto tamano="xs" tono="tenue">
            Ya no se puede clasificar nada con ellas, pero las obras que ya las tenían las
            conservan.
          </Texto>
          <div className="flex flex-col gap-1.5">
            {categorias.map((categoria, i) =>
              categoria.activa ? null : (
                <div
                  key={categoria.id ?? `apagada-${i}`}
                  className="border-linea flex items-center gap-2 rounded-xl border border-dashed px-3 py-2"
                >
                  <Texto tamano="sm" tono="tenue" className="min-w-0 flex-1 truncate">
                    {categoria.nombre}
                    {categoria.id ? ` · ${cuenta(categoria.obras, 'obra')}` : ''}
                  </Texto>
                  {puedeEditar && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => actualizar(i, { activa: true })}
                    >
                      <RotateCcw />
                      Encender
                    </Button>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {puedeEditar && (
        <BarraGuardar
          deshabilitado={guardar.isPending || sinNombre || activas.length === 0}
          cargando={guardar.isPending}
          aviso={
            activas.length === 0
              ? 'Deja al menos una categoría encendida.'
              : sinNombre
                ? 'Hay una categoría sin nombre.'
                : null
          }
          onGuardar={() =>
            guardar.mutate(
              activas.map((c, i) => ({
                id: c.id,
                nombre: c.nombre.trim(),
                icono: c.icono,
                color: c.color,
                orden: i + 1,
                activa: true,
              })),
            )
          }
          etiqueta="Guardar categorías"
        />
      )}
    </div>
  );
}

/* ================================================================== piezas == */

/** «1 obra», «2 obras». Aquí se lee mucho de un vistazo y el plural mal puesto
 *  en una lista de setenta filas canta. */
function cuenta(n: number, singular: string): string {
  return `${n} ${n === 1 ? singular : `${singular}s`}`;
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
        {etiqueta}
      </span>
      {children}
    </div>
  );
}

function BarraGuardar({
  deshabilitado,
  cargando,
  aviso,
  onGuardar,
  etiqueta,
}: {
  deshabilitado: boolean;
  cargando: boolean;
  aviso: string | null;
  onGuardar: () => void;
  etiqueta: string;
}) {
  return (
    <div className="border-linea bg-crema sticky bottom-0 -mx-4 flex flex-col gap-2 border-t px-4 py-3 md:mx-0 md:rounded-2xl md:border md:px-4">
      {aviso && (
        <Texto tamano="sm" className="text-peligro">
          {aviso}
        </Texto>
      )}
      <Button
        variant="institucional"
        size="lg"
        disabled={deshabilitado}
        onClick={onGuardar}
        className="w-full md:w-fit"
      >
        {cargando ? <Loader2 className="animate-spin" /> : <Save />}
        {etiqueta}
      </Button>
    </div>
  );
}
