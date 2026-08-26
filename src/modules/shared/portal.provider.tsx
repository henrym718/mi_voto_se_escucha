'use client';

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

import { HojaVerificacion } from '@/modules/identidad/components/hoja-verificacion';
import { useSesion } from '@/modules/identidad/hooks/use-identidad';
import { useCiudadelas } from '@/modules/catalogo/hooks/use-catalogo';

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
  eslogan: string;
  bio: string;
  foto_url: string | null;
  banner_url: string | null;
  video_url: string | null;
  video_portada_url: string | null;
  logo_url: string | null;
  color_marca: string;
  redes: Record<string, string>;
}

interface Contexto {
  ciudad: DatosCiudad;
  portal: DatosPortal | null;
  cifras: { vecinos: number; obras: number; apoyos: number };
  haySesion: boolean;
  cargandoSesion: boolean;
  /** Abre la hoja de verificación. Se llama justo cuando el vecino va a actuar. */
  pedirVerificacion: (motivo?: 'apoyar' | 'publicar' | 'general', alTerminar?: () => void) => void;
}

const PortalContext = createContext<Contexto | null>(null);

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal se usa dentro de <PortalProvider>');
  return ctx;
}

/**
 * El estado que comparte toda la parte pública. Lo importante que resuelve:
 * cualquier componente puede pedir la verificación sin saber cómo funciona, y
 * el vecino la ve como una hoja sobre lo que estaba haciendo.
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
  const [motivo, setMotivo] = useState<'apoyar' | 'publicar' | 'general'>('general');
  const [alTerminar, setAlTerminar] = useState<(() => void) | null>(null);

  const { data: sesion, isLoading } = useSesion();
  const { data: ciudadelas = [] } = useCiudadelas(ciudad.id);

  const pedirVerificacion = useCallback(
    (m: 'apoyar' | 'publicar' | 'general' = 'general', cb?: () => void) => {
      setMotivo(m);
      setAlTerminar(() => cb ?? null);
      setHojaAbierta(true);
    },
    [],
  );

  const valor = useMemo<Contexto>(
    () => ({
      ciudad,
      portal,
      cifras,
      haySesion: Boolean(sesion),
      cargandoSesion: isLoading,
      pedirVerificacion,
    }),
    [ciudad, portal, cifras, sesion, isLoading, pedirVerificacion],
  );

  return (
    <PortalContext.Provider value={valor}>
      {children}
      <HojaVerificacion
        abierta={hojaAbierta}
        onCerrar={() => setHojaAbierta(false)}
        onListo={() => {
          setHojaAbierta(false);
          alTerminar?.();
        }}
        ciudadSlug={ciudad.slug}
        ciudadelas={ciudadelas}
        motivo={motivo}
        origen={origen}
      />
    </PortalContext.Provider>
  );
}
