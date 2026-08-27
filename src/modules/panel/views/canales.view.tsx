'use client';

import { useState } from 'react';

import { Check, Copy, Link2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { cifra, cn, coincide, telefonoLegible } from '@/shared/lib/utils';

import { useCanales, useGuardarCanales } from '../hooks/use-panel';
import { usePanel } from '../panel.provider';
import { traerContactos } from '../services/panel.service';

/**
 * WhatsApp, sin gastar un centavo por mensaje.
 *
 * Aquí no se envía nada. Se pega, una sola vez, el enlace del canal de cada
 * sector; a partir de ahí, el vecino que acaba de apoyar o publicar ve un botón
 * en su pantalla de confirmación y entra solo. Un canal cuesta lo mismo con
 * cinco personas que con dos mil, y el equipo publica ahí los avances.
 *
 * Debajo está la lista de contactos por sector para el trabajo de territorio:
 * llamar, convocar, armar la brigada. Cada descarga queda en la bitácora.
 */
export function CanalesView() {
  const { ciudad, puedeEditar } = usePanel();
  const { data: canales = [], isLoading } = useCanales(ciudad.id);
  const guardar = useGuardarCanales(ciudad.id);

  // Solo se guarda lo que el equipo teclea; lo demás se lee de la consulta en
  // cada render. Así los enlaces ya guardados aparecen en cuanto llegan, sin un
  // efecto que copie la respuesta a estado y se quede viejo al refrescar.
  const [tecleado, setTecleado] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState('');

  const valorDe = (c: { id: string; enlace_canal: string | null }) =>
    tecleado[c.id] ?? c.enlace_canal ?? '';

  const cambiados = canales.filter(
    (c) => tecleado[c.id] !== undefined && tecleado[c.id] !== (c.enlace_canal ?? ''),
  );
  const visibles = canales.filter((c) => coincide(c.nombre, busqueda));
  const conCanal = canales.filter((c) => c.enlace_canal).length;
  const esperando = canales.reduce((suma, c) => suma + c.esperando, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Titulo nivel="h1">Canales de WhatsApp</Titulo>
        <Texto tamano="sm">
          Un canal por sector. El vecino entra solo desde la pantalla de confirmación, y avisar a
          todo el barrio no cuesta nada.
        </Texto>
      </div>

      <div className="border-linea grid grid-cols-3 gap-3 rounded-2xl border bg-white p-4">
        <Resumen valor={`${conCanal}/${canales.length}`} etiqueta="sectores con canal" />
        <Resumen valor={cifra(esperando)} etiqueta="esperando entrar" />
        <Resumen
          valor={cifra(canales.reduce((s, c) => s + c.contactos, 0))}
          etiqueta="contactos con teléfono"
        />
      </div>

      {/* Con más de setenta sectores, sin buscador esto es un muro. */}
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Busca un sector…"
        className="border-linea focus:border-tinta h-12 w-full rounded-xl border bg-white px-4 text-[0.9375rem] outline-none transition-colors"
      />

      {isLoading ? (
        <div className="flex items-center gap-2 py-12">
          <Loader2 className="text-fg-strong size-5 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibles.map((canal) => (
            <div
              key={canal.id}
              className="border-linea flex flex-col gap-2 rounded-xl border bg-white p-3 md:flex-row md:items-center"
            >
              <div className="flex min-w-0 items-center gap-2 md:w-56">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    canal.enlace_canal ? 'bg-tinta text-white' : 'bg-crema-2 text-fg-subtle',
                  )}
                >
                  {canal.enlace_canal ? (
                    <Check className="size-4" strokeWidth={3} />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-fg-strong truncate text-[0.9375rem] font-semibold">
                    {canal.nombre}
                  </span>
                  <span className="text-fg-subtle text-[0.75rem]">
                    {cifra(canal.contactos)} contactos
                    {canal.esperando > 0 && ` · ${cifra(canal.esperando)} esperando`}
                  </span>
                </span>
              </div>

              <input
                value={valorDe(canal)}
                onChange={(e) => setTecleado((p) => ({ ...p, [canal.id]: e.target.value }))}
                disabled={!puedeEditar}
                placeholder="https://chat.whatsapp.com/…"
                className="border-linea focus:border-tinta h-11 min-w-0 flex-1 rounded-lg border px-3 text-[0.8125rem] outline-none transition-colors disabled:opacity-60"
              />

              <BotonContactos ciudadelaId={canal.id} nombre={canal.nombre} />
            </div>
          ))}

          {visibles.length === 0 && (
            <Texto tamano="sm" className="py-8 text-center">
              No encontramos ese sector.
            </Texto>
          )}
        </div>
      )}

      {/* La barra de guardar solo aparece cuando hay algo que guardar. */}
      {puedeEditar && cambiados.length > 0 && (
        <div className="border-linea sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border bg-white p-3 shadow-lg">
          <Texto tamano="sm" peso="fuerte" tono="normal">
            {cambiados.length} {cambiados.length === 1 ? 'enlace cambiado' : 'enlaces cambiados'}
          </Texto>
          <Button
            variant="accion"
            disabled={guardar.isPending}
            onClick={() =>
              guardar.mutate(
                cambiados.map((c) => ({
                  id: c.id,
                  nombre: c.nombre,
                  enlace_canal: valorDe(c).trim() || null,
                })),
              )
            }
          >
            {guardar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Copia los números de un sector al portapapeles, listos para pegar donde el
 * equipo los necesite. La RPC deja constancia de quién los sacó: son datos de
 * personas reales y esa puerta tiene que estar vigilada.
 */
function BotonContactos({ ciudadelaId, nombre }: { ciudadelaId: string; nombre: string }) {
  const [cargando, setCargando] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={cargando}
      onClick={async () => {
        setCargando(true);
        try {
          const contactos = await traerContactos(ciudadelaId);
          if (contactos.length === 0) {
            toast('En este sector todavía nadie dejó su número.');
            return;
          }
          await navigator.clipboard.writeText(
            contactos.map((c) => telefonoLegible(c.telefono)).join('\n'),
          );
          toast.success(`${contactos.length} números de ${nombre} copiados.`);
        } catch {
          toast.error('No pudimos copiar los contactos.');
        } finally {
          setCargando(false);
        }
      }}
      className="shrink-0"
    >
      {cargando ? <Loader2 className="animate-spin" /> : <Copy className="size-3.5" />}
      Copiar números
    </Button>
  );
}

function Resumen({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="text-fg-strong cifra text-[1.375rem] leading-none font-extrabold">
        {valor}
      </span>
      <span className="text-fg-subtle text-[0.7rem] font-semibold">{etiqueta}</span>
    </div>
  );
}
