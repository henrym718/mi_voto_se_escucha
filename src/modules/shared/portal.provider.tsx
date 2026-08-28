'use client';

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';
import { HojaContacto } from '@/modules/identidad/components/hoja-contacto';
import { useSesionAnonima, useVecino } from '@/modules/identidad/hooks/use-identidad';
import { origenLocal, sectorLocal } from '@/modules/identidad/services/identidad.service';

export interface DatosCiudad {
  id: string;
  slug: string;
  nombre: string;
  provincia: string;
  modo: string;
  poblacion_urbana: number | null;
}

export interface DatosPortal {
  candidato_nombre: string;
  candidato_cargo: string;
  partido: string;
  /** Va junto al nombre: la propaganda electoral en Ecuador la exige. */
  cedula: string | null;
  eslogan: string;
  /** El párrafo bajo el titular. Editable desde el panel, con texto por defecto. */
  hero_subtitulo: string;
  /** Si hay video, la portada ofrece verlo en un modal en vez de ocupar pantalla. */
  hero_medio: 'foto' | 'video';
  /** Enciende la banda del candidato al abrir la portada. Nace apagada. */
  hero_candidato: boolean;
  bio: string;
  foto_url: string | null;
  foto_hero_url: string | null;
  banner_url: string | null;
  video_url: string | null;
  video_portada_url: string | null;
  /** YouTube. Se abre solo la primera visita. Vacío = no aparece nada. */
  video_bienvenida_url: string | null;
  logo_url: string | null;
  color_marca: string;
  redes: Record<string, string>;
}

interface Contexto {
  ciudad: DatosCiudad;
  portal: DatosPortal | null;
  cifras: { vecinos: number; obras: number; apoyos: number };
  /** El sector elegido en el filtro de la portada. `null` = todo el cantón. */
  sector: string | null;
  elegirSector: (id: string | null) => void;
  /**
   * Con qué sector arrancan los formularios: el del filtro si lo puso, y si no
   * el que ya declaró alguna vez. La portada NO lo usa — ahí se abre siempre en
   * todo el cantón, que es donde está lo más apoyado y lo que engancha.
   */
  sectorSugerido: string | null;
  /** Ya dejó su número alguna vez; no hay que volver a pedírselo. */
  tieneContacto: boolean;
  /**
   * Abre el modal del teléfono. Se llama DESPUÉS de que la acción ya ocurrió:
   * el apoyo se registra primero y el número se pide encima, no al revés.
   */
  pedirContacto: (motivo?: 'apoyar' | 'publicar', alTerminar?: () => void) => void;
}

const PortalContext = createContext<Contexto | null>(null);

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal se usa dentro de <PortalProvider>');
  return ctx;
}

/**
 * El estado que comparte toda la parte pública.
 *
 * Lo primero que hace es abrir la sesión anónima, en silencio y sin pedir nada.
 * A partir de ahí el vecino puede apoyar de un toque; el número se le pide una
 * sola vez y encima de lo que estaba haciendo, nunca antes.
 */
export function PortalProvider({
  ciudad,
  portal,
  cifras,
  origen = 'directo',
  children,
}: {
  ciudad: DatosCiudad;
  portal: DatosPortal | null;
  cifras: { vecinos: number; obras: number; apoyos: number };
  origen?: 'directo' | 'qr' | 'compartido';
  children: ReactNode;
}) {
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [motivo, setMotivo] = useState<'apoyar' | 'publicar'>('apoyar');
  const [alTerminar, setAlTerminar] = useState<(() => void) | null>(null);
  // Se inicializa leyendo el navegador, no en un efecto: así el primer pintado
  // ya sale con el barrio del vecino y no con "todo el cantón" un instante.
  const [sector, setSector] = useState<string | null>(() => sectorLocal.leer());

  // El cartel lleva `?via=qr`. Se anota en el navegador la primera vez y se
  // lee de ahí a partir de entonces: el parámetro se pierde en la primera
  // navegación y el teléfono se deja mucho después.
  //
  // Se lee de `window` y NO con useSearchParams: ese hook obliga a envolver el
  // árbol en un <Suspense> y, sin él, el build tumba todas las páginas
  // públicas. Aquí el dato solo hace falta en el navegador, así que no vale la
  // pena arrastrar esa condición hasta el layout.
  const [origenRecordado] = useState<'directo' | 'qr' | 'compartido'>(() => {
    if (typeof window === 'undefined') return origen;
    const via = new URLSearchParams(window.location.search).get('via');
    if (via === 'qr' || via === 'compartido') {
      origenLocal.guardar(via);
      return via;
    }
    const guardado = origenLocal.leer();
    return guardado !== 'directo' ? guardado : origen;
  });

  const { data: sesion } = useSesionAnonima();
  const { data: vecino } = useVecino(Boolean(sesion));
  const { data: ciudadelas = [], isSuccess: catalogoListo } = useCiudadelas(ciudad.id);

  /**
   * Un sector guardado que ya no existe deja la portada vacía y mintiendo.
   *
   * El id vive en el navegador para siempre, pero del otro lado se mueve:
   * staging reconstruye la base en cada despliegue y todos los uuid cambian, y
   * en producción el equipo puede desactivar un sector desde el catálogo. Con
   * un id colgando pasaba esto: el filtro no encontraba ninguna obra —portada
   * vacía, "Todavía no hay causas registradas"— y arriba seguía diciendo "Todo
   * el cantón", porque el nombre tampoco aparecía en el catálogo. Nadie podía
   * deducir qué estaba mal, y recargar no arreglaba nada porque el id seguía
   * guardado. `/obras` no se enteraba: ahí el sector viaja en la URL.
   *
   * Se comprueba contra el catálogo real, y se decide al pintar en vez de en un
   * efecto: así el primer render que ve el catálogo ya sale corregido y no hay
   * un fotograma con la portada vacía. Mientras el catálogo no ha llegado se
   * confía en lo guardado, que es lo correcto en el caso normal.
   */
  const sectorFantasma =
    catalogoListo && sector !== null && !ciudadelas.some((c) => c.id === sector);
  const sectorVigente = sectorFantasma ? null : sector;

  // El efecto solo toca el navegador —el sistema externo—, para que el id
  // muerto no vuelva en la próxima visita. El estado de React ya se corrigió
  // arriba, al derivarlo.
  useEffect(() => {
    if (sectorFantasma) sectorLocal.olvidar();
  }, [sectorFantasma]);

  const elegirSector = useCallback((id: string | null) => {
    setSector(id);
    // Volver a "todo el cantón" también se recuerda. Antes solo se guardaba al
    // elegir un barrio, así que quien salía de uno se lo encontraba de vuelta
    // en la siguiente visita.
    if (id) sectorLocal.guardar(id);
    else sectorLocal.olvidar();
  }, []);

  const pedirContacto = useCallback((m: 'apoyar' | 'publicar' = 'apoyar', cb?: () => void) => {
    setMotivo(m);
    setAlTerminar(() => cb ?? null);
    setHojaAbierta(true);
  }, []);

  const valor = useMemo<Contexto>(
    () => ({
      ciudad,
      portal,
      cifras,
      sector: sectorVigente,
      elegirSector,
      sectorSugerido: sectorVigente ?? vecino?.ciudadela_id ?? null,
      tieneContacto: Boolean(vecino?.tiene_telefono),
      pedirContacto,
    }),
    [ciudad, portal, cifras, sectorVigente, elegirSector, vecino, pedirContacto],
  );

  return (
    <PortalContext.Provider value={valor}>
      {children}
      <HojaContacto
        abierta={hojaAbierta}
        onCerrar={() => setHojaAbierta(false)}
        onListo={() => {
          setHojaAbierta(false);
          alTerminar?.();
        }}
        ciudadSlug={ciudad.slug}
        ciudadelas={ciudadelas}
        sectorSugerido={sectorVigente ?? vecino?.ciudadela_id ?? null}
        motivo={motivo}
        origen={origenRecordado}
      />
    </PortalContext.Provider>
  );
}
