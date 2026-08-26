'use client';

import { useState } from 'react';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { parseAsString, useQueryStates } from 'nuqs';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { useCategorias, useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';
import { usePortal } from '@/modules/shared/portal.provider';
import { cifra, cn } from '@/shared/lib/utils';

import { TarjetaObra, TarjetaObraEsqueleto } from '../components/tarjeta-obra';
import { useObras } from '../hooks/use-obras';

const ORDENES = [
  { valor: 'apoyos', etiqueta: 'Más apoyadas' },
  { valor: 'recientes', etiqueta: 'Recientes' },
  { valor: 'movimiento', etiqueta: 'Con avances' },
] as const;

export function ObrasView() {
  const { ciudad, haySesion, pedirVerificacion } = usePortal();
  const [panelFiltros, setPanelFiltros] = useState(false);

  // Los filtros viven en la URL: así el enlace que alguien comparta al grupo
  // llega con el barrio ya puesto, y el botón de atrás del teléfono funciona.
  const [filtros, setFiltros] = useQueryStates({
    barrio: parseAsString,
    categoria: parseAsString,
    q: parseAsString,
    orden: parseAsString.withDefault('apoyos'),
  });

  const { data: ciudadelas = [] } = useCiudadelas(ciudad.id);
  const { data: categorias = [] } = useCategorias(ciudad.id);

  const { data, isLoading, isPlaceholderData } = useObras(ciudad.slug, {
    ciudadelaId: filtros.barrio,
    categoriaId: filtros.categoria,
    busqueda: filtros.q,
    orden: filtros.orden as 'apoyos' | 'recientes' | 'movimiento',
    limite: 30,
  });

  const activos = [filtros.barrio, filtros.categoria, filtros.q].filter(Boolean).length;
  const nombreBarrio = ciudadelas.find((c) => c.id === filtros.barrio)?.nombre;
  const nombreCategoria = categorias.find((c) => c.id === filtros.categoria)?.nombre;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-5 md:px-6 md:pt-8 lg:max-w-7xl">
      <div className="flex flex-col gap-1">
        <Titulo nivel="h1">Obras pedidas</Titulo>
        <Texto tamano="sm">
          {data ? `${cifra(data.total)} pedidos en ${ciudad.nombre}` : 'Cargando…'}
          {nombreBarrio && ` · ${nombreBarrio}`}
          {nombreCategoria && ` · ${nombreCategoria}`}
        </Texto>
      </div>

      {/* --------------------------------------------------------- buscador -- */}
      <div className="flex gap-2">
        <div className="border-linea focus-within:border-tinta flex h-12 flex-1 items-center gap-2.5 rounded-xl border bg-white px-4 transition-all focus-within:ring-3">
          <Search className="text-fg-subtle size-[18px] shrink-0" />
          <input
            type="search"
            placeholder="Buscar obra o barrio…"
            value={filtros.q ?? ''}
            onChange={(e) => void setFiltros({ q: e.target.value || null })}
            className="min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none"
          />
          {filtros.q && (
            <button
              type="button"
              onClick={() => void setFiltros({ q: null })}
              aria-label="Limpiar búsqueda"
              className="text-fg-subtle hover:text-fg-default"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPanelFiltros((v) => !v)}
          aria-expanded={panelFiltros}
          className={cn(
            'relative flex size-12 shrink-0 items-center justify-center rounded-xl border transition-all',
            panelFiltros || activos > 0
              ? 'border-tinta bg-crema-2 text-fg-strong'
              : 'border-linea text-fg-muted bg-white',
          )}
        >
          <SlidersHorizontal className="size-[18px]" />
          {activos > 0 && (
            <span className="bg-tinta absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[0.65rem] font-bold text-white">
              {activos}
            </span>
          )}
        </button>
      </div>

      {/* ---------------------------------------------------------- filtros -- */}
      <AnimatePresence initial={false}>
        {panelFiltros && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-linea flex flex-col gap-4 rounded-2xl border bg-white p-4">
              <GrupoFiltro
                titulo="Ciudadela"
                opciones={ciudadelas.map((c) => ({ id: c.id, nombre: c.nombre }))}
                elegido={filtros.barrio}
                onElegir={(id) => void setFiltros({ barrio: id })}
              />
              <GrupoFiltro
                titulo="Categoría"
                opciones={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
                elegido={filtros.categoria}
                onElegir={(id) => void setFiltros({ categoria: id })}
              />
              {activos > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void setFiltros({ barrio: null, categoria: null, q: null })}
                  className="self-start"
                >
                  <X className="size-4" />
                  Quitar filtros
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------------- orden -- */}
      <div className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {ORDENES.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => void setFiltros({ orden: o.valor })}
            className={cn(
              'min-h-9 shrink-0 rounded-full px-4 text-[0.8125rem] font-semibold transition-all active:scale-95',
              filtros.orden === o.valor
                ? 'bg-tinta text-crema'
                : 'border-linea text-fg-muted border bg-white',
            )}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>

      {/* --------------------------------------------------------- listado -- */}
      <div className={cn('flex flex-col gap-3 transition-opacity md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3', isPlaceholderData && 'opacity-55')}>
        {isLoading
          ? [0, 1, 2, 3].map((i) => <TarjetaObraEsqueleto key={i} indice={i} />)
          : (data?.items ?? []).map((obra, i) => (
              <TarjetaObra
                key={obra.id}
                obra={obra}
                indice={i}
                haySesion={haySesion}
                onNecesitaSesion={() => pedirVerificacion('apoyar')}
              />
            ))}
      </div>

      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <div className="border-linea flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
          <Texto peso="fuerte" tono="normal">
            No encontramos obras con esos filtros.
          </Texto>
          <Texto tamano="sm">Prueba quitando alguno, o publica tú el pedido que falta.</Texto>
        </div>
      )}
    </div>
  );
}

function GrupoFiltro({
  titulo,
  opciones,
  elegido,
  onElegir,
}: {
  titulo: string;
  opciones: { id: string; nombre: string }[];
  elegido: string | null;
  onElegir: (id: string | null) => void;
}) {
  const [verTodos, setVerTodos] = useState(false);
  const visibles = verTodos ? opciones : opciones.slice(0, 8);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
        {titulo}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {visibles.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onElegir(elegido === o.id ? null : o.id)}
            className={cn(
              'min-h-9 rounded-full px-3.5 text-[0.8125rem] font-medium transition-all active:scale-95',
              elegido === o.id
                ? 'bg-tinta text-white'
                : 'border-linea text-fg-muted hover:border-tinta border bg-white',
            )}
          >
            {o.nombre}
          </button>
        ))}
        {opciones.length > 8 && (
          <button
            type="button"
            onClick={() => setVerTodos((v) => !v)}
            className="text-fg-strong underline min-h-9 px-2 text-[0.8125rem] font-semibold"
          >
            {verTodos ? 'Ver menos' : `Ver los ${opciones.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
