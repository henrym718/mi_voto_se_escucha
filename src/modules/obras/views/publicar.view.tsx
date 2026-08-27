'use client';

import { useRef, useState } from 'react';

import Link from 'next/link';

import { Camera, Check, ImageIcon, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { useCategorias, useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';
import { GrabadorVoz } from '@/modules/ia/components/grabador-voz';
import { usePortal } from '@/modules/shared/portal.provider';
import { RUTAS } from '@/shared/config/rutas';
import { cn, coincide } from '@/shared/lib/utils';

import { useCrearObra } from '../hooks/use-obras';
import { subirFotoDePedido, subirNotaDeVoz } from '../services/subida.service';

/**
 * Reportar un problema, en dos pasos y sin escribir una línea si no se quiere.
 *
 * El orden es deliberado: sector y categoría se eligen de una lista cerrada —
 * texto libre ahí llena la base de "el pedrero", "El Pedrero" y "mi barrio", y
 * el mapa de calor deja de existir— y recién después se cuenta el problema,
 * hablando, que es como lo cuenta la gente de verdad.
 *
 * Lo que el vecino dice NO se le devuelve corregido ni se le pide que lo
 * apruebe: eso lo hace el equipo en su cola. Aquí termina en un toque.
 */
export function PublicarView() {
  const { ciudad, sectorSugerido, tieneContacto, pedirContacto } = usePortal();

  // El sector del pedido es el del PROBLEMA, no el del vecino, así que vive
  // aquí y no toca el filtro de la portada. Arranca en el que ya declaró —casi
  // siempre acierta— y se deriva en vez de copiarse: `sectorSugerido` llega
  // después del primer pintado y un efecto que lo copiara se quedaría viejo.
  const [sectorTocado, setSectorTocado] = useState<string | null>(null);
  const sector = sectorTocado ?? sectorSugerido;

  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [audio, setAudio] = useState<{ blob: Blob; segundos: number } | null>(null);
  const [foto, setFoto] = useState<{ archivo: File; vista: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [publicado, setPublicado] = useState<{ codigo: string; enlaceCanal?: string | null } | null>(
    null,
  );

  const { data: ciudadelas = [] } = useCiudadelas(ciudad.id);
  const { data: categorias = [] } = useCategorias(ciudad.id);
  const crear = useCrearObra();

  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const hayContenido = texto.trim().length >= 10 || Boolean(audio);
  const listo = Boolean(sector && categoriaId && hayContenido);

  function elegirArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    setFoto({ archivo, vista: URL.createObjectURL(archivo) });
    evento.target.value = '';
  }

  async function enviar() {
    if (!sector || !categoriaId || !hayContenido) return;
    setEnviando(true);

    try {
      // La nota de voz es lo único que no puede perderse: si falla su subida,
      // se corta aquí en vez de mandar un pedido vacío que nadie podrá leer.
      let audioRuta: string | null = null;
      if (audio) audioRuta = await subirNotaDeVoz(audio.blob);

      let fotoUrl: string | null = null;
      if (foto) {
        try {
          fotoUrl = await subirFotoDePedido(foto.archivo);
        } catch {
          // La foto es un extra: si no sube, el pedido igual vale.
          toast.error('No pudimos subir la foto, pero tu pedido sí se envió.');
        }
      }

      const respuesta = await crear.mutateAsync({
        ciudadelaId: sector,
        categoriaId,
        texto: texto.trim() || null,
        audioRuta,
        fotoUrl,
      });

      if (!respuesta.success || !respuesta.obra) return;

      setPublicado({ codigo: respuesta.obra.codigo, enlaceCanal: respuesta.enlace_canal });
      // El pedido ya está adentro. El número se pide encima de la confirmación,
      // nunca antes: si alguien lo cierra, su reporte sigue en pie.
      if (!tieneContacto) pedirContacto('publicar');
    } catch {
      toast.error('No pudimos enviar tu nota de voz. Revisa tu señal e intenta otra vez.');
    } finally {
      setEnviando(false);
    }
  }

  if (publicado) {
    return <Confirmacion codigo={publicado.codigo} enlaceCanal={publicado.enlaceCanal} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-5 pb-8 md:px-6 md:pt-8">
      <div className="flex flex-col gap-1.5">
        <Titulo nivel="h1">Cuéntanos qué falta</Titulo>
        <Texto tamano="sm">
          Dinos dónde y de qué se trata, y después cuéntalo hablando. El equipo lo ordena y lo
          publica.
        </Texto>
      </div>

      <Paso numero={1} titulo="¿En qué sector?" completo={Boolean(sector)}>
        <SelectorSectores ciudadelas={ciudadelas} elegido={sector} onElegir={setSectorTocado} />
      </Paso>

      <Paso numero={2} titulo="¿De qué se trata?" completo={Boolean(categoriaId)}>
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <Pastilla
              key={c.id}
              activa={categoriaId === c.id}
              onClick={() => setCategoriaId(c.id)}
              texto={c.nombre}
            />
          ))}
        </div>
      </Paso>

      <AnimatePresence>
        {sector && categoriaId && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
          >
            <Paso numero={3} titulo="¿Qué está pasando?" completo={hayContenido}>
              <div className="flex flex-col gap-4">
                {/* La voz primero y en grande: mucha gente del cantón escribe
                    con dificultad pero manda audios todo el día. */}
                {audio ? (
                  <div className="border-tinta flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3">
                    <span className="bg-tinta flex size-10 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-5 text-white" strokeWidth={3} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-fg-strong text-[0.9375rem] font-semibold">
                        Nota de voz lista
                      </span>
                      <span className="text-fg-subtle text-[0.8125rem]">
                        {audio.segundos} segundos grabados
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAudio(null)}
                      aria-label="Borrar la nota de voz"
                      className="text-fg-subtle hover:text-fg-strong flex size-9 items-center justify-center rounded-full transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-linea rounded-2xl border-2 border-dashed bg-white p-4">
                    <GrabadorVoz
                      onGrabado={(blob, segundos) => setAudio({ blob, segundos })}
                      disabled={enviando}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
                    O escríbelo en pocas palabras
                  </span>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Ej. La calle 4 lleva dos meses sin alumbrado y de noche no se ve nada."
                    className="border-linea focus:border-tinta w-full resize-none rounded-2xl border-2 bg-white px-4 py-3 text-[0.9375rem] outline-none transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
                    Una foto ayuda <span className="normal-case">(opcional)</span>
                  </span>

                  {foto ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={foto.vista}
                        alt=""
                        className="max-h-56 w-full rounded-2xl object-cover"
                      />
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
                      {/* `capture` abre la cámara directo; sin él el navegador
                          ofrece la galería y se pierde el gesto de "sal y
                          tómale la foto ahora mismo". */}
                      <input
                        ref={camara}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={elegirArchivo}
                        className="hidden"
                      />
                      <input
                        ref={galeria}
                        type="file"
                        accept="image/*"
                        onChange={elegirArchivo}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => camara.current?.click()}
                        className="flex-1"
                      >
                        <Camera />
                        Tomar foto
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => galeria.current?.click()}
                        className="flex-1"
                      >
                        <ImageIcon />
                        Galería
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Paso>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="accion"
        size="xl"
        disabled={!listo || enviando || crear.isPending}
        onClick={() => void enviar()}
        className="w-full"
      >
        {enviando || crear.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        {enviando ? 'Enviando…' : 'Enviar mi pedido'}
      </Button>
    </div>
  );
}

/** Lo último que ve el vecino. Tres segundos de lectura y una salida clara. */
function Confirmacion({ codigo, enlaceCanal }: { codigo: string; enlaceCanal?: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 pt-16 pb-8 text-center"
    >
      <span className="bg-tinta flex size-16 items-center justify-center rounded-full">
        <Check className="size-8 text-white" strokeWidth={3} />
      </span>

      <div className="flex flex-col gap-2">
        <Titulo nivel="h1">¡Recibido!</Titulo>
        <Texto>
          Tu reporte pasa a revisión del equipo técnico para sumarlo al plan de trabajo. Puedes
          seguirlo aquí mismo cuando se publique.
        </Texto>
      </div>

      {/* De uno a muchos y a costo cero: es todo el aviso por WhatsApp que
          hace el sistema, y lo pide el vecino, no lo impone la campaña. */}
      {enlaceCanal && (
        <a
          href={enlaceCanal}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-tinta hover:bg-tinta-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-[1rem] font-semibold text-white transition-colors active:translate-y-px"
        >
          <MessageCircle className="size-5" />
          Únete al canal de tu sector
        </a>
      )}

      <div className="flex w-full flex-col gap-2">
        <Button variant="outline" size="lg" asChild className="w-full">
          <Link href={RUTAS.publico.obra(codigo)}>Ver mi pedido</Link>
        </Button>
        <Button variant="ghost" size="lg" asChild className="w-full">
          <Link href={RUTAS.publico.inicio}>Volver al inicio</Link>
        </Button>
      </div>
    </motion.div>
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
            'flex size-7 items-center justify-center rounded-full text-[0.8125rem] font-bold transition-colors',
            completo ? 'bg-tinta text-white' : 'bg-crema-2 text-fg-muted',
          )}
        >
          {completo ? <Check className="size-4" strokeWidth={3} /> : numero}
        </span>
        <Titulo nivel="h3">{titulo}</Titulo>
      </div>
      {children}
    </section>
  );
}

function Pastilla({
  activa,
  onClick,
  texto,
}: {
  activa: boolean;
  onClick: () => void;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full border-2 px-4 text-[0.875rem] font-semibold transition-colors',
        activa
          ? 'border-tinta bg-tinta text-white'
          : 'border-linea text-fg-default bg-white hover:bg-crema-2',
      )}
    >
      {texto}
    </button>
  );
}

/**
 * Lista cerrada con buscador. Con más de setenta sectores, desplegarlos todos
 * convierte el paso 1 en un scroll interminable; con el buscador, escribir tres
 * letras deja el barrio a un toque.
 */
function SelectorSectores({
  ciudadelas,
  elegido,
  onElegir,
}: {
  ciudadelas: { id: string; nombre: string }[];
  elegido: string | null;
  onElegir: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const elegida = ciudadelas.find((c) => c.id === elegido);

  if (elegida && !busqueda) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Pastilla activa onClick={() => setBusqueda(' ')} texto={elegida.nombre} />
        <button
          type="button"
          onClick={() => setBusqueda(' ')}
          className="text-fg-muted hover:text-fg-strong min-h-11 px-2 text-[0.875rem] font-semibold transition-colors"
        >
          Cambiar
        </button>
      </div>
    );
  }

  const filtradas = ciudadelas.filter((c) => coincide(c.nombre, busqueda)).slice(0, 24);

  return (
    <div className="flex flex-col gap-2.5">
      <input
        type="search"
        value={busqueda.trim()}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Busca tu sector…"
        className="border-linea focus:border-tinta h-12 w-full rounded-2xl border-2 bg-white px-4 text-[0.9375rem] outline-none transition-colors"
      />
      <div className="flex flex-wrap gap-2">
        {filtradas.map((c) => (
          <Pastilla
            key={c.id}
            activa={elegido === c.id}
            onClick={() => {
              onElegir(c.id);
              setBusqueda('');
            }}
            texto={c.nombre}
          />
        ))}
        {filtradas.length === 0 && (
          <Texto tamano="sm">No encontramos ese sector. Revisa cómo lo escribiste.</Texto>
        )}
      </div>
    </div>
  );
}
