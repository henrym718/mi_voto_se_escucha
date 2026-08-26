'use client';

import { useState } from 'react';

import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { useEstados } from '@/modules/catalogo/hooks/use-catalogo';
import { cn } from '@/shared/lib/utils';

import { useGuardarEstados } from '../hooks/use-panel';
import { usePanel } from '../panel.provider';

interface EstadoEditable {
  id?: string;
  nombre: string;
  descripcion: string;
  color: string;
  orden: number;
  es_inicial: boolean;
  es_compromiso: boolean;
  es_cierre_suave: boolean;
  notifica: boolean;
}

const COLORES = ['#8b8993', '#4a90a4', '#1f7a4d', '#c98a12', '#7a6a9a', '#0d7d6c', '#a4443c'];

/**
 * Aquí es donde una misma plataforma sirve para campaña y para gestión: las
 * columnas del tablero son estas filas. Un cliente que gana la elección no
 * cambia de producto, cambia esta lista.
 */
export function EstadosView() {
  const { ciudad } = usePanel();
  const { data: existentes = [], isLoading } = useEstados(ciudad.id);
  const guardar = useGuardarEstados(ciudad.id);

  const [estados, setEstados] = useState<EstadoEditable[]>([]);
  const [tocado, setTocado] = useState(false);
  const [cargadoDe, setCargadoDe] = useState<string | null>(null);

  // Sembrar el formulario con lo que hay en la base. Va durante el render y no
  // en un efecto: es el patrón que React recomienda para ajustar estado cuando
  // cambian los datos de entrada, y evita un render de más con la lista vacía.
  // Una vez que el equipo toca algo, deja de sincronizarse para no pisarle lo
  // que está escribiendo.
  const firma = existentes.map((e) => e.id).join(',');
  if (existentes.length > 0 && cargadoDe !== firma && !tocado) {
    setCargadoDe(firma);
    setEstados(
      existentes.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        descripcion: e.descripcion,
        color: e.color,
        orden: e.orden,
        es_inicial: e.es_inicial,
        es_compromiso: e.es_compromiso,
        es_cierre_suave: e.es_cierre_suave,
        notifica: e.notifica,
      })),
    );
  }

  function actualizar(indice: number, cambios: Partial<EstadoEditable>) {
    setTocado(true);
    setEstados((prev) =>
      prev.map((e, i) => {
        if (i !== indice) {
          // Solo puede haber un estado inicial: marcar uno apaga el anterior.
          return cambios.es_inicial ? { ...e, es_inicial: false } : e;
        }
        return { ...e, ...cambios };
      }),
    );
  }

  function mover(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion;
    if (destino < 0 || destino >= estados.length) return;
    setTocado(true);
    setEstados((prev) => {
      const copia = [...prev];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia.map((e, i) => ({ ...e, orden: i + 1 }));
    });
  }

  const sinInicial = estados.filter((e) => e.es_inicial).length !== 1;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-16">
        <Loader2 className="text-teal size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Titulo nivel="h1">Estados</Titulo>
        <Texto tamano="sm">
          Estas son las columnas del tablero. Cambiarlas cambia cómo el vecino ve el avance de
          su obra, así que conviene dejarlas claras desde el inicio.
        </Texto>
      </div>

      <div className="bg-arena flex flex-col gap-1 rounded-2xl px-4 py-3">
        <Texto tamano="sm" peso="fuerte" tono="normal">
          Un consejo que sale caro aprender
        </Texto>
        <Texto tamano="sm">
          Evita estados que digan que algo no se puede hacer. Nadie quiere leer &ldquo;no
          viable&rdquo; en la página del candidato al que va a votar. En su lugar, usa cierres
          suaves como &ldquo;En estudio técnico&rdquo;: informan igual, sin costo político.
        </Texto>
      </div>

      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {estados.map((estado, i) => (
            <motion.div
              key={estado.id ?? `nuevo-${i}`}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir"
                    className="text-fg-faint hover:text-fg-default disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === estados.length - 1}
                    aria-label="Bajar"
                    className="text-fg-faint hover:text-fg-default disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>

                <input
                  value={estado.nombre}
                  onChange={(e) => actualizar(i, { nombre: e.target.value })}
                  placeholder="Nombre del estado"
                  className="border-linea focus:border-teal h-11 min-w-0 flex-1 rounded-xl border px-3 text-[0.9375rem] font-semibold outline-none"
                />

                <button
                  type="button"
                  onClick={() => {
                    setTocado(true);
                    setEstados((prev) => prev.filter((_, j) => j !== i));
                  }}
                  aria-label="Quitar estado"
                  className="text-fg-faint hover:text-peligro flex size-9 shrink-0 items-center justify-center rounded-xl"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <input
                value={estado.descripcion}
                onChange={(e) => actualizar(i, { descripcion: e.target.value })}
                placeholder="Qué le decimos al vecino cuando su obra llega aquí"
                className="border-linea focus:border-teal h-10 w-full rounded-xl border px-3 text-[0.8125rem] outline-none"
              />

              <div className="flex flex-wrap items-center gap-1.5">
                {COLORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => actualizar(i, { color: c })}
                    aria-label={`Color ${c}`}
                    className={cn(
                      'size-7 rounded-full transition-transform',
                      estado.color === c ? 'ring-fg-default scale-110 ring-2 ring-offset-2' : '',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Marca
                  activa={estado.es_inicial}
                  onCambiar={(v) => actualizar(i, { es_inicial: v })}
                  etiqueta="Estado inicial"
                  ayuda="Donde caen los pedidos nuevos"
                />
                <Marca
                  activa={estado.notifica}
                  onCambiar={(v) => actualizar(i, { notifica: v })}
                  etiqueta="Avisa por WhatsApp"
                  ayuda="A quienes apoyaron la obra"
                />
                <Marca
                  activa={estado.es_compromiso}
                  onCambiar={(v) => actualizar(i, { es_compromiso: v })}
                  etiqueta="Es un compromiso"
                  ayuda="Promesa pública del candidato"
                />
                <Marca
                  activa={estado.es_cierre_suave}
                  onCambiar={(v) => actualizar(i, { es_cierre_suave: v })}
                  etiqueta="Cierre suave"
                  ayuda="Cierra sin decir que no"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            setTocado(true);
            setEstados((prev) => [
              ...prev,
              {
                nombre: '',
                descripcion: '',
                color: COLORES[prev.length % COLORES.length],
                orden: prev.length + 1,
                es_inicial: prev.length === 0,
                es_compromiso: false,
                es_cierre_suave: false,
                notifica: true,
              },
            ]);
          }}
        >
          <Plus />
          Agregar estado
        </Button>
      </div>

      {sinInicial && (
        <Texto tamano="sm" className="text-peligro">
          Marca exactamente un estado como inicial antes de guardar.
        </Texto>
      )}

      <div className="border-linea bg-crema sticky bottom-0 -mx-4 flex gap-2 border-t px-4 py-3 md:mx-0 md:rounded-2xl md:border md:px-4">
        <Button
          variant="institucional"
          size="lg"
          disabled={guardar.isPending || sinInicial || estados.some((e) => !e.nombre.trim())}
          onClick={() =>
            guardar.mutate(estados.map((e, i) => ({ ...e, orden: i + 1, activo: true })))
          }
          className="flex-1 md:flex-none"
        >
          {guardar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar estados
        </Button>
      </div>
    </div>
  );
}

function Marca({
  activa,
  onCambiar,
  etiqueta,
  ayuda,
}: {
  activa: boolean;
  onCambiar: (v: boolean) => void;
  etiqueta: string;
  ayuda: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onCambiar(!activa)}
      title={ayuda}
      className={cn(
        'flex min-h-9 flex-col items-start rounded-xl px-3 py-1.5 text-left transition-colors',
        activa ? 'bg-teal-pastel text-teal-hondo' : 'bg-crema-2 text-fg-subtle',
      )}
    >
      <span className="text-[0.75rem] font-bold">{etiqueta}</span>
      <span className="text-[0.65rem] opacity-75">{ayuda}</span>
    </button>
  );
}
