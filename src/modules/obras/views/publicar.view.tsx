'use client';

import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Camera, Check, ImageIcon, Info, Loader2, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { useCategorias, useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';
import { usePortal } from '@/modules/shared/portal.provider';
import { RUTAS } from '@/shared/config/rutas';
import { cifra, cn, porcentaje } from '@/shared/lib/utils';

import { BotonApoyar } from '../components/boton-apoyar';
import { useCrearObra, useSimilares } from '../hooks/use-obras';
import { subirFotoDePedido } from '../services/subida.service';

/**
 * "Buscar antes de crear". El orden importa: primero se le muestra al vecino lo
 * que ya existe en su barrio y en su categoría, con un botón grande de apoyar.
 * Solo si nada le sirve puede escribir. Sin esto se terminan cuarenta pedidos
 * de alcantarillado con un voto cada uno, y el ranking no le sirve a nadie.
 */
export function PublicarView() {
  const router = useRouter();
  const { ciudad, haySesion, pedirVerificacion } = usePortal();

  const [ciudadelaId, setCiudadelaId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  const { data: ciudadelas = [] } = useCiudadelas(ciudad.id);
  const { data: categorias = [] } = useCategorias(ciudad.id);
  const { data: similares = [], isLoading: buscando } = useSimilares(ciudadelaId, categoriaId);

  const listoParaBuscar = Boolean(ciudadelaId && categoriaId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-5 pb-8 md:px-6 md:pt-8">
      <div className="flex flex-col gap-1.5">
        <Titulo nivel="h1">Publicar mi pedido</Titulo>
        <Texto tamano="sm">
          Primero dinos dónde y de qué se trata. Si alguien ya lo pidió, apóyalo: juntos pesan
          mucho más que dos pedidos separados.
        </Texto>
      </div>

      <Paso numero={1} titulo="¿En qué ciudadela?" completo={Boolean(ciudadelaId)}>
        <SelectorPastillas
          opciones={ciudadelas.map((c) => ({ id: c.id, nombre: c.nombre }))}
          elegido={ciudadelaId}
          onElegir={(id) => {
            setCiudadelaId(id);
            setFormularioAbierto(false);
          }}
          buscable
        />
      </Paso>

      <AnimatePresence>
        {ciudadelaId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Paso numero={2} titulo="¿De qué se trata?" completo={Boolean(categoriaId)}>
              <SelectorPastillas
                opciones={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
                elegido={categoriaId}
                onElegir={(id) => {
                  setCategoriaId(id);
                  setFormularioAbierto(false);
                }}
              />
            </Paso>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {listoParaBuscar && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4"
          >
            {buscando ? (
              <div className="border-linea flex items-center justify-center gap-2 rounded-2xl border bg-white py-10">
                <Loader2 className="text-teal size-5 animate-spin" />
                <Texto tamano="sm">Buscando pedidos parecidos…</Texto>
              </div>
            ) : similares.length > 0 ? (
              <>
                <div className="bg-teal-pastel flex items-start gap-2.5 rounded-2xl px-4 py-3.5">
                  <Info className="text-teal-hondo mt-0.5 size-4 shrink-0" />
                  <Texto tamano="sm" tono="normal">
                    Ya hay <strong>{similares.length}</strong>{' '}
                    {similares.length === 1 ? 'pedido parecido' : 'pedidos parecidos'} en este
                    sector. Si alguno es el tuyo, apóyalo en vez de crear otro.
                  </Texto>
                </div>

                <div className="flex flex-col gap-3">
                  {similares.map((obra, i) => (
                    <motion.div
                      key={obra.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: i * 0.06 }}
                      className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-fg-strong text-[1rem] font-semibold">
                          {obra.titulo}
                        </span>
                        <span className="text-fg-subtle text-[0.8125rem]">
                          {cifra(obra.apoyos)} {obra.apoyos === 1 ? 'vecino apoya' : 'vecinos apoyan'}
                          {obra.porcentaje_ciudadela > 0 &&
                            ` · ${porcentaje(obra.porcentaje_ciudadela)} del barrio`}{' '}
                          · {obra.estado.nombre}
                        </span>
                      </div>
                      {obra.descripcion && (
                        <Texto tamano="sm" className="line-clamp-2">
                          {obra.descripcion}
                        </Texto>
                      )}
                      <BotonApoyar
                        obraId={obra.id}
                        apoyos={obra.apoyos}
                        yaApoyada={obra.ya_apoyada}
                        haySesion={haySesion}
                        onNecesitaSesion={() => pedirVerificacion('apoyar')}
                        tamano="xl"
                        mostrarConteo={false}
                        className="w-full"
                      />
                    </motion.div>
                  ))}
                </div>

                <div className="flex items-center gap-3 py-1">
                  <span className="bg-linea h-px flex-1" />
                  <span className="text-fg-subtle text-[0.7rem] font-bold tracking-[0.1em] uppercase">
                    ¿Ninguno es tu problema?
                  </span>
                  <span className="bg-linea h-px flex-1" />
                </div>
              </>
            ) : (
              <div className="bg-arena flex items-start gap-2.5 rounded-2xl px-4 py-3.5">
                <Info className="text-alerta mt-0.5 size-4 shrink-0" />
                <Texto tamano="sm" tono="normal">
                  Nadie ha pedido nada de esto en tu sector todavía. Sé el primero.
                </Texto>
              </div>
            )}

            {!formularioAbierto ? (
              <Button
                variant={similares.length > 0 ? 'outline' : 'accion'}
                size="xl"
                onClick={() => setFormularioAbierto(true)}
                className="w-full"
              >
                <Plus />
                {similares.length > 0 ? 'Mi problema es diferente' : 'Publicar el primer pedido'}
              </Button>
            ) : (
              <FormularioPedido
                ciudadelaId={ciudadelaId!}
                categoriaId={categoriaId!}
                haySesion={haySesion}
                onNecesitaSesion={() => pedirVerificacion('publicar')}
                onPublicado={(codigo) => router.push(RUTAS.publico.obra(codigo))}
              />
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function Paso({
  numero,
  titulo,
  completo,
  children,
}: {
  numero: number;
  titulo: string;
  completo: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'cifra flex size-7 items-center justify-center rounded-full text-[0.8125rem] font-bold transition-colors',
            completo ? 'bg-teal text-white' : 'bg-crema-2 text-fg-muted',
          )}
        >
          {completo ? <Check className="size-4" /> : numero}
        </span>
        <Titulo nivel="h3">{titulo}</Titulo>
      </div>
      {children}
    </section>
  );
}

function SelectorPastillas({
  opciones,
  elegido,
  onElegir,
  buscable = false,
}: {
  opciones: { id: string; nombre: string }[];
  elegido: string | null;
  onElegir: (id: string) => void;
  buscable?: boolean;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [verTodas, setVerTodas] = useState(false);

  const filtradas = busqueda.trim()
    ? opciones.filter((o) => o.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : verTodas
      ? opciones
      : opciones.slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      {buscable && (
        <input
          type="search"
          placeholder="Busca tu ciudadela…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border-linea focus:border-teal focus:ring-teal/20 h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition-all focus:ring-3"
        />
      )}
      <div className="flex flex-wrap gap-2">
        {filtradas.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onElegir(o.id)}
            className={cn(
              'min-h-11 rounded-full px-4 text-[0.875rem] font-medium transition-all active:scale-95',
              elegido === o.id
                ? 'bg-teal text-white shadow-sm'
                : 'border-linea hover:border-teal border bg-white',
            )}
          >
            {o.nombre}
          </button>
        ))}
        {!busqueda && !verTodas && opciones.length > 10 && (
          <button
            type="button"
            onClick={() => setVerTodas(true)}
            className="text-teal min-h-11 px-2 text-[0.875rem] font-semibold"
          >
            Ver las {opciones.length}
          </button>
        )}
      </div>
    </div>
  );
}

function FormularioPedido({
  ciudadelaId,
  categoriaId,
  haySesion,
  onNecesitaSesion,
  onPublicado,
}: {
  ciudadelaId: string;
  categoriaId: string;
  haySesion: boolean;
  onNecesitaSesion: () => void;
  onPublicado: (codigo: string) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [foto, setFoto] = useState<{ archivo: File; vista: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const crear = useCrearObra();

  const tituloValido = titulo.trim().length >= 8;

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setFoto({ archivo, vista: URL.createObjectURL(archivo) });
    e.target.value = '';
  }

  async function publicar() {
    if (!haySesion) {
      onNecesitaSesion();
      return;
    }
    if (!tituloValido) return;

    let fotoUrl: string | null = null;
    if (foto) {
      setSubiendo(true);
      try {
        fotoUrl = await subirFotoDePedido(foto.archivo);
      } catch {
        // La foto es opcional: si falla la subida, el pedido igual se publica.
        toast.error('No pudimos subir la foto, pero publicamos tu pedido.');
      } finally {
        setSubiendo(false);
      }
    }

    const respuesta = await crear.mutateAsync({
      ciudadelaId,
      categoriaId,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      fotoUrl,
    });

    if (respuesta.success && respuesta.obra) onPublicado(respuesta.obra.codigo);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="border-linea flex flex-col gap-4 rounded-2xl border border-dashed bg-white p-5"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="titulo" className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
          ¿Qué hace falta?
        </label>
        <input
          id="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value.slice(0, 120))}
          placeholder="Ej. Rejilla dañada en la calle 4"
          className="border-linea focus:border-teal focus:ring-teal/20 h-13 w-full rounded-xl border px-4 text-base outline-none transition-all focus:ring-3"
        />
        <div className="flex items-center justify-between">
          <Texto tamano="xs" tono="tenue">
            {titulo.length < 8 ? 'Al menos 8 letras' : 'Se ve bien'}
          </Texto>
          <Texto tamano="xs" tono="tenue" className="cifra">
            {titulo.length}/120
          </Texto>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="detalle" className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
          Cuéntanos un poco más <span className="normal-case">(opcional)</span>
        </label>
        <textarea
          id="detalle"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value.slice(0, 1000))}
          rows={4}
          placeholder="Desde cuándo pasa, a cuántas casas afecta, en qué parte exacta…"
          className="border-linea focus:border-teal focus:ring-teal/20 w-full resize-none rounded-xl border px-4 py-3 text-base outline-none transition-all focus:ring-3"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
          Una foto ayuda <span className="normal-case">(opcional)</span>
        </span>

        {foto ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.vista} alt="" className="max-h-56 w-full rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => setFoto(null)}
              aria-label="Quitar foto"
              className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {/* `capture` abre la cámara directo; sin él el navegador ofrece la
                galería y se pierde el gesto de "sal y toma la foto ahora". */}
            <input
              ref={camara}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={elegirArchivo}
              className="hidden"
            />
            <input ref={galeria} type="file" accept="image/*" onChange={elegirArchivo} className="hidden" />
            <Button variant="outline" size="lg" onClick={() => camara.current?.click()} className="flex-1">
              <Camera />
              Tomar foto
            </Button>
            <Button variant="outline" size="lg" onClick={() => galeria.current?.click()} className="flex-1">
              <ImageIcon />
              Galería
            </Button>
          </div>
        )}
      </div>

      <Button
        variant="accion"
        size="xl"
        disabled={!tituloValido || crear.isPending || subiendo}
        onClick={() => void publicar()}
        className="w-full"
      >
        {crear.isPending || subiendo ? <Loader2 className="animate-spin" /> : <Plus />}
        {subiendo ? 'Subiendo la foto…' : 'Publicar mi pedido'}
      </Button>

      <Texto tamano="xs" tono="tenue" className="text-center">
        Tu pedido pasa por una revisión rápida del equipo antes de aparecer. Te avisamos por
        WhatsApp cuando se publique.
      </Texto>
    </motion.div>
  );
}
