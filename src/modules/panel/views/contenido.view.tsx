'use client';

import { useState } from 'react';

import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2, User, Users } from 'lucide-react';
import { motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';

import { CampoArchivo } from '../components/campo-archivo';
import {
  useGuardarPerfiles,
  useGuardarPortal,
  usePerfiles,
  usePortalDelPanel,
} from '../hooks/use-panel';
import { usePanel } from '../panel.provider';
import type { DatosDelPortal, PerfilDelEquipo } from '../services/panel.service';

const REDES = ['facebook', 'instagram', 'youtube', 'tiktok'] as const;

const PORTAL_VACIO: DatosDelPortal = {
  candidato_nombre: '',
  candidato_cargo: '',
  partido: '',
  cedula: '',
  eslogan: '',
  hero_subtitulo: '',
  hero_medio: 'foto',
  hero_candidato: false,
  bio: '',
  foto_url: null,
  foto_hero_url: null,
  banner_url: null,
  video_url: null,
  video_portada_url: null,
  video_bienvenida_url: null,
  logo_url: null,
  color_marca: '#0d7d6c',
  redes: {},
};

/**
 * La portada deja de ser código. Todo lo que el vecino ve arriba del todo —
 * la credencial del candidato, el titular, el recorte de la foto o el video, el
 * color de marca — se edita aquí, y con una vista previa al lado para no tener
 * que abrir el sitio en otra pestaña a cada cambio.
 *
 * Vender una ciudad nueva era comprar un dominio y cargar datos; esta pantalla
 * es la mitad de "cargar datos" que faltaba.
 */
export function ContenidoView() {
  const { ciudad, puedeEditar } = usePanel();
  const [pestana, setPestana] = useState<'portada' | 'perfiles'>('portada');

  const portal = usePortalDelPanel(ciudad.slug);
  const perfiles = usePerfiles(ciudad.id);

  const cargando = pestana === 'portada' ? portal.isLoading : perfiles.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Titulo nivel="h1">Portada y perfiles</Titulo>
        <Texto tamano="sm">
          Lo que ve un vecino que entra por primera vez a {ciudad.nombre}. Se guarda al instante y
          se publica al recargar el sitio.
        </Texto>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['portada', 'La portada'],
            ['perfiles', 'Los perfiles'],
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
            Tu cuenta es de solo lectura: puedes mirar cómo está configurado, pero no guardar.
          </Texto>
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="text-fg-muted size-6 animate-spin" />
        </div>
      ) : pestana === 'portada' ? (
        <FormularioPortada
          inicial={portal.data ?? PORTAL_VACIO}
          nombreCiudad={ciudad.nombre}
          ciudadId={ciudad.id}
          ciudadSlug={ciudad.slug}
          puedeEditar={puedeEditar}
        />
      ) : (
        <EditorPerfiles
          inicial={perfiles.data ?? []}
          ciudadId={ciudad.id}
          puedeEditar={puedeEditar}
        />
      )}
    </div>
  );
}

/* ========================================================== la portada == */

function FormularioPortada({
  inicial,
  nombreCiudad,
  ciudadId,
  ciudadSlug,
  puedeEditar,
}: {
  inicial: DatosDelPortal;
  nombreCiudad: string;
  ciudadId: string;
  ciudadSlug: string;
  puedeEditar: boolean;
}) {
  // El estado arranca del dato ya cargado porque el padre no monta esto hasta
  // tenerlo: nada de sembrar el formulario desde un efecto, que es como se
  // pierde lo que alguien está escribiendo cuando la consulta se refresca.
  const [datos, setDatos] = useState<DatosDelPortal>(inicial);
  const guardar = useGuardarPortal(ciudadId, ciudadSlug);

  const cambiar = (parcial: Partial<DatosDelPortal>) => setDatos((d) => ({ ...d, ...parcial }));

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Bloque titulo="La credencial" ayuda="La línea de arriba del todo, junto a la foto chica.">
          <Campo etiqueta="Nombre">
            <Entrada
              valor={datos.candidato_nombre}
              onCambio={(v) => cambiar({ candidato_nombre: v })}
              placeholder="Fernando Flores"
            />
          </Campo>
          <Campo etiqueta="Cargo al que aspira">
            <Entrada
              valor={datos.candidato_cargo}
              onCambio={(v) => cambiar({ candidato_cargo: v })}
              placeholder="Candidato a la Alcaldía de El Triunfo"
            />
          </Campo>
          <Campo etiqueta="Movimiento o partido">
            <Entrada
              valor={datos.partido}
              onCambio={(v) => cambiar({ partido: v })}
              placeholder="Movimiento Político Ciudadano"
            />
          </Campo>
          <Campo
            etiqueta="Cédula"
            ayuda="Se muestra junto al nombre. La propaganda electoral en Ecuador la lleva."
          >
            <Entrada
              valor={datos.cedula ?? ''}
              onCambio={(v) => cambiar({ cedula: v })}
              placeholder="0912345678"
            />
          </Campo>
        </Bloque>

        <Bloque
          titulo="El mensaje"
          ayuda="Lo primero que se lee. Corto y en primera persona plural."
        >
          <Campo etiqueta="Titular">
            <AreaTexto
              valor={datos.eslogan}
              onCambio={(v) => cambiar({ eslogan: v })}
              filas={2}
              maximo={120}
              placeholder={`${nombreCiudad} lo decidimos entre todos`}
            />
          </Campo>
          <Campo etiqueta="Párrafo de abajo">
            <AreaTexto
              valor={datos.hero_subtitulo}
              onCambio={(v) => cambiar({ hero_subtitulo: v })}
              filas={3}
              maximo={280}
              placeholder="Pide la obra que le hace falta a tu barrio y apoya las de tus vecinos. Las más apoyadas entran al plan de obras."
            />
          </Campo>
        </Bloque>

        <Bloque
          titulo="Video de bienvenida"
          ayuda="Se abre solo la primera vez que alguien entra, y una sola vez. Sirve para explicar en medio minuto para qué es esto. Si lo dejas vacío, no aparece nada."
        >
          <Campo etiqueta="Enlace de YouTube">
            <Entrada
              valor={datos.video_bienvenida_url ?? ''}
              onCambio={(v) => cambiar({ video_bienvenida_url: v })}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </Campo>
          <Texto tamano="xs" tono="tenue">
            Que sea corto. Es lo primero que ve alguien que llegó por un enlace de WhatsApp y
            todavía no sabe si esto es una encuesta, un trámite o una campaña.
          </Texto>
        </Bloque>

        <Bloque
          titulo="La portada del candidato"
          ayuda="Una banda con la foto, el cargo y el eslogan, arriba del todo en la página pública. Viene apagada."
        >
          <button
            type="button"
            role="switch"
            aria-checked={datos.hero_candidato}
            onClick={() => cambiar({ hero_candidato: !datos.hero_candidato })}
            className="border-linea hover:border-tinta flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-colors"
          >
            <span
              className={cn(
                'flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors',
                datos.hero_candidato ? 'bg-tinta' : 'bg-crema-2',
              )}
            >
              <span
                className={cn(
                  'size-5 rounded-full bg-white shadow-sm transition-transform',
                  datos.hero_candidato ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-fg-strong text-[0.9375rem] font-semibold">
                {datos.hero_candidato ? 'Encendida' : 'Apagada'}
              </span>
              <span className="text-fg-muted text-[0.8125rem]">
                {datos.hero_candidato
                  ? 'La página abre con la cara del candidato, antes del titular.'
                  : 'La página abre con «¿Qué necesita tu sector?».'}
              </span>
            </span>
          </button>

          {/* El costo, escrito al lado del interruptor y no en un documento que
              nadie va a leer. Quien lo encienda que sepa lo que cambia. */}
          <div className="bg-crema-2 flex flex-col gap-1 rounded-2xl px-4 py-3">
            <Texto tamano="sm" peso="fuerte" tono="normal">
              Antes de encenderla
            </Texto>
            <Texto tamano="sm">
              La foto grande del candidato en lo primero que se ve es propaganda de cartelera, y a
              mucha gente le activa el filtro anti-política: se va antes de mirar una sola obra. El
              resto de la portada está armada al revés a propósito —primero el problema del barrio,
              después quién lo va a resolver—. Si la campaña exige la foto arriba, aquí está; solo
              conviene saber lo que cuesta.
            </Texto>
          </div>
        </Bloque>

        <Bloque
          titulo="Qué acompaña al titular"
          ayuda="La foto recortada llena el lado derecho de punta a punta. El video se muestra con su portada y no arranca solo."
        >
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['foto', 'La foto recortada'],
                ['video', 'El video'],
              ] as const
            ).map(([id, texto]) => (
              <button
                key={id}
                type="button"
                onClick={() => cambiar({ hero_medio: id })}
                className={cn(
                  'min-h-11 rounded-full px-4 text-[0.875rem] font-semibold transition-all active:translate-y-px',
                  datos.hero_medio === id
                    ? 'bg-tinta text-white'
                    : 'border-linea hover:border-tinta border bg-white',
                )}
              >
                {texto}
              </button>
            ))}
          </div>

          {datos.hero_medio === 'foto' ? (
            <CampoArchivo
              etiqueta="Recorte del candidato"
              ayuda="PNG sin fondo, de cuerpo entero o medio cuerpo. Se ancla abajo a la derecha."
              valor={datos.foto_hero_url}
              onCambio={(url) => cambiar({ foto_hero_url: url })}
              ciudadId={ciudadId}
              forma="alta"
            />
          ) : (
            <>
              <CampoArchivo
                etiqueta="Video de presentación"
                ayuda="MP4 o WebM. Menos de un minuto: se ve con datos móviles."
                valor={datos.video_url}
                onCambio={(url) => cambiar({ video_url: url })}
                ciudadId={ciudadId}
                tipo="video"
                forma="ancha"
              />
              <CampoArchivo
                etiqueta="Portada del video"
                ayuda="La imagen que se ve antes de darle play."
                valor={datos.video_portada_url}
                onCambio={(url) => cambiar({ video_portada_url: url })}
                ciudadId={ciudadId}
                forma="ancha"
              />
            </>
          )}
        </Bloque>

        <Bloque titulo="Marca" ayuda="El color tiñe el hero y los acentos de toda la aplicación.">
          <CampoArchivo
            etiqueta="Foto chica de la credencial"
            ayuda="Un primer plano de la cara. Se muestra redonda."
            valor={datos.foto_url}
            onCambio={(url) => cambiar({ foto_url: url })}
            ciudadId={ciudadId}
          />
          <CampoArchivo
            etiqueta="Fondo del hero"
            ayuda="Opcional. Va detrás del degradado, muy atenuado."
            valor={datos.banner_url}
            onCambio={(url) => cambiar({ banner_url: url })}
            ciudadId={ciudadId}
            forma="ancha"
          />
          <Campo etiqueta="Color de marca">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={datos.color_marca}
                onChange={(e) => cambiar({ color_marca: e.target.value })}
                className="border-linea size-12 cursor-pointer rounded-xl border bg-white p-1"
              />
              <Entrada
                valor={datos.color_marca}
                onCambio={(v) => cambiar({ color_marca: v })}
                placeholder="#0d7d6c"
              />
            </div>
          </Campo>
        </Bloque>

        <Bloque titulo="Redes" ayuda="Se muestran en la ficha del candidato.">
          {REDES.map((red) => (
            <Campo key={red} etiqueta={red}>
              <Entrada
                valor={datos.redes?.[red] ?? ''}
                onCambio={(v) => cambiar({ redes: { ...datos.redes, [red]: v } })}
                placeholder={`https://${red}.com/…`}
              />
            </Campo>
          ))}
        </Bloque>

        <Button
          size="xl"
          variant="accion"
          disabled={!puedeEditar || guardar.isPending}
          onClick={() => guardar.mutate(datos)}
          className="self-start"
        >
          {guardar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar la portada
        </Button>
      </div>

      {/* La vista previa es lo que convierte esto en una pantalla de edición y
          no en un formulario a ciegas. Es una miniatura fiel del hero real. */}
      <div className="lg:sticky lg:top-6 lg:w-[22rem] lg:shrink-0">
        <span className="text-fg-muted mb-2 block text-[0.7rem] font-bold tracking-[0.12em] uppercase">
          Así se verá
        </span>
        <VistaPreviaHero datos={datos} nombreCiudad={nombreCiudad} />
      </div>
    </div>
  );
}

function VistaPreviaHero({ datos, nombreCiudad }: { datos: DatosDelPortal; nombreCiudad: string }) {
  const conFoto = datos.hero_medio === 'foto' && datos.foto_hero_url;

  return (
    <div
      className="relative flex min-h-52 overflow-hidden rounded-3xl"
      style={{
        background: `linear-gradient(150deg, ${datos.color_marca} 0%, color-mix(in oklab, ${datos.color_marca} 72%, black) 100%)`,
      }}
    >
      <div className={cn('relative flex flex-col gap-2.5 p-4', conFoto && 'max-w-[62%]')}>
        <div className="flex items-center gap-2">
          {datos.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={datos.foto_url}
              alt=""
              className="size-8 shrink-0 rounded-full border border-white/40 object-cover"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15">
              <User className="size-3.5 text-white/80" />
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[0.5rem] font-bold tracking-[0.06em] text-white uppercase">
              {datos.candidato_cargo || 'Cargo'}
              {datos.partido && (
                <span className="text-white/60 normal-case"> — {datos.partido}</span>
              )}
            </span>
            <span className="truncate text-[0.5rem] text-white/60">
              {datos.candidato_nombre || 'Nombre'}
              {datos.cedula && ` | Cédula: ${datos.cedula}`}
            </span>
          </div>
        </div>

        <span className="text-[1.0625rem] leading-[1.1] font-extrabold tracking-[-0.03em] text-white">
          {datos.eslogan || `${nombreCiudad} lo decidimos entre todos`}
        </span>
        <span className="line-clamp-3 text-[0.625rem] leading-snug text-white/85">
          {datos.hero_subtitulo ||
            'Pide la obra que le hace falta a tu barrio y apoya las de tus vecinos.'}
        </span>

        <div className="mt-1 flex gap-1.5">
          <span className="text-fg-strong rounded-full bg-white px-2.5 py-1 text-[0.5rem] font-bold">
            + Publicar mi pedido
          </span>
          <span className="rounded-full border border-white/40 bg-white/10 px-2.5 py-1 text-[0.5rem] font-bold text-white">
            Ver todas las obras
          </span>
        </div>
      </div>

      {conFoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={datos.foto_hero_url!}
          alt=""
          className="absolute inset-y-0 right-0 h-full w-[42%] object-cover object-bottom"
        />
      )}

      {datos.hero_medio === 'video' && datos.video_url && (
        <div className="absolute inset-y-4 right-4 w-[38%] overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/20">
          {datos.video_portada_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={datos.video_portada_url} alt="" className="size-full object-cover" />
          )}
        </div>
      )}
    </div>
  );
}

/* ========================================================= los perfiles == */

const PERFIL_NUEVO: PerfilDelEquipo = {
  id: null,
  nombre: '',
  cargo: '',
  cedula: null,
  foto_url: null,
  bio: '',
  telefono: null,
  correo: null,
  redes: {},
  video_url: null,
  es_candidato: false,
};

function EditorPerfiles({
  inicial,
  ciudadId,
  puedeEditar,
}: {
  inicial: PerfilDelEquipo[];
  ciudadId: string;
  puedeEditar: boolean;
}) {
  const [perfiles, setPerfiles] = useState<PerfilDelEquipo[]>(inicial);
  const [abierto, setAbierto] = useState<number | null>(inicial.length === 0 ? null : 0);
  const guardar = useGuardarPerfiles(ciudadId);

  function actualizar(indice: number, cambios: Partial<PerfilDelEquipo>) {
    setPerfiles((prev) =>
      prev.map((p, i) => {
        // Solo una ficha puede ser la del candidato: marcar una apaga la otra.
        if (i !== indice) return cambios.es_candidato ? { ...p, es_candidato: false } : p;
        return { ...p, ...cambios };
      }),
    );
  }

  function mover(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion;
    if (destino < 0 || destino >= perfiles.length) return;
    setPerfiles((prev) => {
      const copia = [...prev];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
    setAbierto(destino);
  }

  return (
    <div className="flex flex-col gap-4">
      <Texto tamano="sm">
        El orden de esta lista es el orden en la página. Quien esté marcado como candidato sale
        siempre primero. Quitar a alguien esconde su ficha, no borra su historial.
      </Texto>

      <div className="flex flex-col gap-3">
        {perfiles.map((perfil, i) => (
          <motion.div
            key={perfil.id ?? `nuevo-${i}`}
            layout
            className="border-linea overflow-hidden rounded-2xl border bg-white"
          >
            <div className="flex items-center gap-3 p-3">
              {perfil.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={perfil.foto_url}
                  alt=""
                  className="border-linea size-11 shrink-0 rounded-full border object-cover"
                />
              ) : (
                <div className="border-linea flex size-11 shrink-0 items-center justify-center rounded-full border">
                  <User className="text-fg-faint size-5" />
                </div>
              )}

              <button
                type="button"
                onClick={() => setAbierto(abierto === i ? null : i)}
                className="flex min-w-0 flex-1 flex-col items-start text-left"
              >
                <span className="text-fg-strong truncate text-[0.9375rem] font-semibold">
                  {perfil.nombre || 'Sin nombre'}
                </span>
                <span className="text-fg-muted truncate text-[0.8125rem] font-medium">
                  {perfil.cargo || 'Sin cargo'}
                  {perfil.es_candidato && ' · candidato'}
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Subir"
                  disabled={i === 0}
                  onClick={() => mover(i, -1)}
                >
                  <ChevronUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Bajar"
                  disabled={i === perfiles.length - 1}
                  onClick={() => mover(i, 1)}
                >
                  <ChevronDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar"
                  onClick={() => {
                    setPerfiles((prev) => prev.filter((_, j) => j !== i));
                    setAbierto(null);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            {abierto === i && (
              <div className="border-linea flex flex-col gap-4 border-t p-4">
                <Campo etiqueta="Nombre">
                  <Entrada
                    valor={perfil.nombre}
                    onCambio={(v) => actualizar(i, { nombre: v })}
                    placeholder="María Zambrano"
                  />
                </Campo>
                <Campo etiqueta="Cargo">
                  <Entrada
                    valor={perfil.cargo}
                    onCambio={(v) => actualizar(i, { cargo: v })}
                    placeholder="Coordinadora de barrios"
                  />
                </Campo>
                <CampoArchivo
                  etiqueta="Foto"
                  valor={perfil.foto_url}
                  onCambio={(url) => actualizar(i, { foto_url: url })}
                  ciudadId={ciudadId}
                />
                <Campo
                  etiqueta="Quién es"
                  ayuda="Dos o tres frases. Separa párrafos con una línea en blanco."
                >
                  <AreaTexto
                    valor={perfil.bio}
                    onCambio={(v) => actualizar(i, { bio: v })}
                    filas={4}
                    maximo={1200}
                    placeholder="A qué se dedica y qué hace en la campaña."
                  />
                </Campo>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo etiqueta="Cédula">
                    <Entrada
                      valor={perfil.cedula ?? ''}
                      onCambio={(v) => actualizar(i, { cedula: v })}
                      placeholder="0912345678"
                    />
                  </Campo>
                  <Campo etiqueta="Teléfono público">
                    <Entrada
                      valor={perfil.telefono ?? ''}
                      onCambio={(v) => actualizar(i, { telefono: v })}
                      placeholder="0991234567"
                    />
                  </Campo>
                </div>
                <Campo etiqueta="Correo">
                  <Entrada
                    valor={perfil.correo ?? ''}
                    onCambio={(v) => actualizar(i, { correo: v })}
                    placeholder="nombre@ejemplo.com"
                  />
                </Campo>
                <Campo
                  etiqueta="Video de presentación"
                  ayuda="Enlace de YouTube. Sale como un botón de play en la ficha y se ve sin salir de la página. Solo se aceptan enlaces de YouTube."
                >
                  <Entrada
                    valor={perfil.video_url ?? ''}
                    onCambio={(v) => actualizar(i, { video_url: v })}
                    placeholder="https://www.youtube.com/watch?v=…"
                  />
                </Campo>
                <div className="grid gap-4 sm:grid-cols-2">
                  {REDES.map((red) => (
                    <Campo key={red} etiqueta={red}>
                      <Entrada
                        valor={perfil.redes?.[red] ?? ''}
                        onCambio={(v) => actualizar(i, { redes: { ...perfil.redes, [red]: v } })}
                        placeholder={`https://${red}.com/…`}
                      />
                    </Campo>
                  ))}
                </div>
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={perfil.es_candidato}
                    onChange={(e) => actualizar(i, { es_candidato: e.target.checked })}
                    className="accent-tinta size-4.5"
                  />
                  <span className="text-fg-default text-[0.875rem] font-medium">
                    Es la ficha del candidato
                  </span>
                </label>
              </div>
            )}
          </motion.div>
        ))}

        {perfiles.length === 0 && (
          <div className="border-linea flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white px-6 py-10 text-center">
            <Users className="text-fg-faint size-7" />
            <Texto tamano="sm" peso="fuerte" tono="normal">
              Todavía no hay perfiles.
            </Texto>
            <Texto tamano="sm">
              Mientras la lista esté vacía, la página pública muestra la ficha del candidato armada
              con los datos de la portada.
            </Texto>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setPerfiles((prev) => [...prev, { ...PERFIL_NUEVO }]);
            setAbierto(perfiles.length);
          }}
        >
          <Plus />
          Agregar un perfil
        </Button>
        <Button
          variant="accion"
          disabled={!puedeEditar || guardar.isPending}
          onClick={() => guardar.mutate(perfiles)}
        >
          {guardar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar los perfiles
        </Button>
      </div>
    </div>
  );
}

/* =========================================================== ladrillos == */

function Bloque({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-linea flex flex-col gap-4 rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <Titulo nivel="h3">{titulo}</Titulo>
        {ayuda && (
          <Texto tamano="xs" tono="tenue">
            {ayuda}
          </Texto>
        )}
      </div>
      {children}
    </section>
  );
}

function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
        {etiqueta}
      </span>
      {children}
      {ayuda && (
        <Texto tamano="xs" tono="tenue">
          {ayuda}
        </Texto>
      )}
    </label>
  );
}

function Entrada({
  valor,
  onCambio,
  placeholder,
}: {
  valor: string;
  onCambio: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      placeholder={placeholder}
      className="border-linea focus:border-tinta h-12 w-full rounded-xl border bg-white px-4 text-base transition-all outline-none focus:ring-3"
    />
  );
}

function AreaTexto({
  valor,
  onCambio,
  filas,
  maximo,
  placeholder,
}: {
  valor: string;
  onCambio: (v: string) => void;
  filas: number;
  maximo: number;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={valor}
        onChange={(e) => onCambio(e.target.value.slice(0, maximo))}
        rows={filas}
        placeholder={placeholder}
        className="border-linea focus:border-tinta w-full resize-none rounded-xl border bg-white px-4 py-3 text-base leading-relaxed transition-all outline-none focus:ring-3"
      />
      <Texto tamano="xs" tono="tenue" className="cifra self-end">
        {valor.length}/{maximo}
      </Texto>
    </div>
  );
}
