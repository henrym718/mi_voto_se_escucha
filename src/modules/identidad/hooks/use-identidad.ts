'use client';

import { useEffect, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabaseNavegador } from '@/shared/lib/supabase/client';

import * as servicio from '../services/identidad.service';

export const clavesIdentidad = {
  todo: ['identidad'] as const,
  sesion: () => [...clavesIdentidad.todo, 'sesion'] as const,
  vecino: () => [...clavesIdentidad.todo, 'vecino'] as const,
};

/** Hay sesión o no. Se recalcula cuando Supabase avisa que cambió. */
export function useSesion() {
  const queryClient = useQueryClient();

  const consulta = useQuery({
    queryKey: clavesIdentidad.sesion(),
    queryFn: servicio.sesionActual,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const supabase = supabaseNavegador();
    const { data } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: clavesIdentidad.todo });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return consulta;
}

export function usePedirCodigo() {
  return useMutation({
    mutationFn: servicio.pedirCodigo,
    onError: (error) =>
      toast.error(
        error instanceof servicio.ErrorOtp
          ? error.message
          : 'No pudimos enviar el código. Intenta otra vez en un momento.',
      ),
  });
}

export function useVerificarCodigo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      telefono,
      codigo,
      ciudadSlug,
      ciudadelaId,
      origen,
    }: {
      telefono: string;
      codigo: string;
      ciudadSlug: string;
      ciudadelaId?: string | null;
      origen?: 'directo' | 'qr' | 'compartido';
    }) =>
      servicio
        .verificarCodigo(telefono, codigo)
        .then(() => servicio.asegurarVecino(ciudadSlug, ciudadelaId, origen)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clavesIdentidad.todo });
    },
    onError: () => toast.error('Ese código no es válido o ya venció. Pide uno nuevo.'),
  });
}

/**
 * Alta idempotente del vecino cuando YA hay sesión (no consume ningún código).
 * Es lo que permite retomar a quien verificó su número pero cerró la hoja sin
 * elegir ciudadela: se le pregunta solo lo que le falta, no todo de nuevo.
 */
export function useAsegurarVecino() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ciudadSlug,
      origen,
    }: {
      ciudadSlug: string;
      origen?: 'directo' | 'qr' | 'compartido';
    }) => servicio.asegurarVecino(ciudadSlug, null, origen),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clavesIdentidad.todo });
    },
  });
}

export function useElegirCiudadela() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: servicio.elegirCiudadela,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clavesIdentidad.todo });
      queryClient.invalidateQueries({ queryKey: ['obras'] });
    },
  });
}

export function useGuardarPerfil() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: servicio.guardarPerfil,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clavesIdentidad.vecino() });
      toast.success('Gracias. Con esto tu sector pesa más en el reporte.');
    },
  });
}

/** Cuenta atrás para volver a pedir el código, en segundos. */
export function useCuentaRegresiva(inicial = 0) {
  const [segundos, setSegundos] = useState(inicial);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  return [segundos, setSegundos] as const;
}
