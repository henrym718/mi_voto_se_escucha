'use client';

import { useState } from 'react';

import { Loader2, Plus } from 'lucide-react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useCategorias, useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';
import { cn } from '@/shared/lib/utils';

import { useCrearObraDelEquipo } from '../hooks/use-panel';
import { usePanel } from '../panel.provider';

/**
 * El equipo levanta un pedido por su cuenta.
 *
 * Es la mitad que faltaba de la cola: la mayoría de lo que se pide en un cantón
 * no llega escrito por internet — llega en una asamblea de barrio, por teléfono
 * o porque el candidato lo vio al caminar la ciudadela. Sin esta puerta, todo
 * eso se perdía o entraba a mano por la base de datos.
 *
 * Nace publicado y con cero apoyos: el equipo decide qué se muestra, pero el
 * respaldo lo siguen poniendo los vecinos apoyándolo.
 */
export function HojaNuevoPedido({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const { ciudad } = usePanel();
  const { data: ciudadelas = [] } = useCiudadelas(ciudad.id);
  const { data: categorias = [] } = useCategorias(ciudad.id);
  const crear = useCrearObraDelEquipo();

  const [ciudadelaId, setCiudadelaId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fuente, setFuente] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const listo = Boolean(ciudadelaId && categoriaId) && titulo.trim().length >= 8;

  function limpiar() {
    setCiudadelaId(null);
    setCategoriaId(null);
    setTitulo('');
    setDescripcion('');
    setFuente('');
    setBusqueda('');
  }

  async function publicar() {
    if (!listo) return;
    const r = await crear.mutateAsync({
      ciudadelaId: ciudadelaId!,
      categoriaId: categoriaId!,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      fuente: fuente.trim() || null,
    });
    if (!r.success) return;
    limpiar();
    onCerrar();
  }

  const filtradas = busqueda.trim()
    ? ciudadelas.filter((c) => c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : ciudadelas;

  return (
    <Drawer open={abierta} onOpenChange={(v) => !v && onCerrar()}>
      <DrawerContent className="bg-crema border-linea max-h-[92vh]">
        <DrawerTitle className="sr-only">Levantar un pedido</DrawerTitle>

        <div className="mx-auto flex w-full max-w-lg flex-col gap-5 overflow-y-auto px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-1.5">
            <Titulo nivel="h2">Levantar un pedido</Titulo>
            <Texto tamano="sm">
              Para lo que llega por asamblea, por teléfono o de recorrer el barrio. Se publica
              directo, sin pasar por la cola, y arranca con cero apoyos.
            </Texto>
          </div>

          <section className="flex flex-col gap-2">
            <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
              Ciudadela
            </span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca la ciudadela…"
              className="border-linea focus:border-tinta h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition-all focus:ring-3"
            />
            <div className="-mx-1 max-h-40 overflow-y-auto px-1">
              <div className="flex flex-wrap gap-2 py-1">
                {filtradas.map((c) => (
                  <Pastilla
                    key={c.id}
                    activa={ciudadelaId === c.id}
                    onClick={() => setCiudadelaId(c.id)}
                  >
                    {c.nombre}
                  </Pastilla>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
              Categoría
            </span>
            <div className="flex flex-wrap gap-2">
              {categorias.map((c) => (
                <Pastilla
                  key={c.id}
                  activa={categoriaId === c.id}
                  onClick={() => setCategoriaId(c.id)}
                >
                  {c.nombre}
                </Pastilla>
              ))}
            </div>
          </section>

          {/* Aquí escribe el equipo, no un vecino: quien levanta el pedido en
              una asamblea ya sabe redactarlo, y meter la IA en medio sería una
              espera sin motivo. El ayudante trabaja donde hace falta — sobre lo
              que el vecino cuenta hablando. */}
          <section className="flex flex-col gap-2">
            <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
              Título
            </span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value.slice(0, 120))}
              placeholder="Rejilla rota en la calle 4 frente a la escuela"
              className="border-linea focus:border-tinta h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition-all focus:ring-3"
            />
            <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
              Descripción
            </span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Qué pasa, desde cuándo y a quién afecta. Dos o tres frases."
              className="border-linea focus:border-tinta w-full resize-none rounded-xl border bg-white px-4 py-3 text-base outline-none transition-all focus:ring-3"
            />
          </section>

          <section className="flex flex-col gap-2">
            <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
              De dónde salió <span className="normal-case">(opcional)</span>
            </span>
            <input
              value={fuente}
              onChange={(e) => setFuente(e.target.value.slice(0, 200))}
              placeholder="Asamblea de La Unión, 14 de marzo"
              className="border-linea focus:border-tinta h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition-all focus:ring-3"
            />
            <Texto tamano="xs" tono="tenue">
              Se muestra al vecino junto al pedido. Citar la fuente es lo que hace que un pedido
              del equipo no parezca inventado.
            </Texto>
          </section>

          <Button
            size="xl"
            variant="accion"
            disabled={!listo || crear.isPending}
            onClick={() => void publicar()}
            className="w-full"
          >
            {crear.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Publicar el pedido
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Pastilla({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full px-4 text-[0.875rem] font-medium transition-all active:scale-95',
        activa ? 'bg-tinta text-white shadow-sm' : 'border-linea hover:border-tinta border bg-white',
      )}
    >
      {children}
    </button>
  );
}
