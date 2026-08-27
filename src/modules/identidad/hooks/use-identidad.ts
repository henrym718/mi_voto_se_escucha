'use client';

import { useEffect } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabaseNavegador } from '@/shared/lib/supabase/client';

import * as servicio from '../services/identidad.service';

export const clavesIdentidad = {
  todo: ['identidad'] as const,
  sesion: () => [...clavesIdentidad.todo, 'sesion'] as const,
  vecino: () => [...clavesIdentidad.todo, 'vecino'] as const,
};

/**
 * Abre la sesión anónima en cuanto carga la página pública. Es lo primero que
 * pasa y nadie lo ve: cuando el vecino toque Apoyar, la sesión ya está lista y
 * el apoyo se registra en un viaje, no en dos.
 */
export function useSesionAnonima() {
  const queryClient = useQueryClient();

  const consulta = useQuery({
    queryKey: clavesIdentidad.sesion(),
    queryFn: servicio.asegurarSesion,
    staleTime: Infinity,
    retry: 1,
  });

  useEffect(() => {
    const supabase = supabaseNavegador();
    const { data } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: clavesIdentidad.vecino() });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return consulta;
}

/** Qué sabemos del vecino. Solo se pregunta cuando ya hay sesión. */
export function useVecino(haySesion: boolean) {
  return useQuery({
    queryKey: clavesIdentidad.vecino(),
    queryFn: servicio.vecinoActual,
    enabled: haySesion,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGuardarContacto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: servicio.guardarContacto,
    onSuccess: (respuesta) => {
      if (!respuesta.success) {
        toast.error(
          respuesta.error_code === 'telefono_invalido'
            ? 'Ese número no parece un celular. Revísalo, va con 10 dígitos.'
            : 'No pudimos guardar tu número. Intenta otra vez.',
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: clavesIdentidad.vecino() });
    },
    onError: () => toast.error('No pudimos guardar tu número. Intenta otra vez.'),
  });
}

export function useElegirSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: servicio.elegirSector,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clavesIdentidad.vecino() }),
  });
}
