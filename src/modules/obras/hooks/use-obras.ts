'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

import * as servicio from '../services/obras.service';
import { type ObrasFiltros, mensajeDeError } from '../types/obras.types';

/**
 * Todo lo de TanStack Query del módulo vive aquí: las claves, las consultas y
 * las mutaciones con su invalidación. Cuando algo no se refresca, se busca en
 * este archivo y no en diez componentes distintos.
 */
export const clavesObras = {
  todo: ['obras'] as const,
  lista: (ciudad: string, filtros: ObrasFiltros) =>
    [...clavesObras.todo, 'lista', ciudad, filtros] as const,
  detalle: (id: string) => [...clavesObras.todo, 'detalle', id] as const,
  porCodigo: (codigo: string) => [...clavesObras.todo, 'codigo', codigo] as const,
  ranking: (ciudadela: string) => [...clavesObras.todo, 'ranking', ciudadela] as const,
};

export function useObras(ciudadSlug: string, filtros: ObrasFiltros = {}) {
  return useQuery({
    queryKey: clavesObras.lista(ciudadSlug, filtros),
    queryFn: () => servicio.listarObras(ciudadSlug, filtros),
    // Al cambiar de barrio no se vacía la lista: se queda la anterior atenuada
    // mientras llega la nueva. En 3G eso evita el parpadeo a blanco.
    placeholderData: keepPreviousData,
  });
}

export function useObra(params: { id?: string; codigo?: string }, habilitada = true) {
  return useQuery({
    queryKey: params.id
      ? clavesObras.detalle(params.id)
      : clavesObras.porCodigo(params.codigo ?? ''),
    queryFn: () => servicio.obtenerObra(params),
    enabled: habilitada && Boolean(params.id || params.codigo),
  });
}

export function useRankingBarrio(ciudadelaId?: string | null, limite = 5) {
  return useQuery({
    queryKey: clavesObras.ranking(ciudadelaId ?? ''),
    queryFn: () => servicio.rankingDeBarrio(ciudadelaId!, limite),
    enabled: Boolean(ciudadelaId),
  });
}

/**
 * Apoyar.
 *
 * `onApoyado` se dispara cuando el apoyo YA quedó registrado: es donde la
 * portada decide si pedirle el número. El orden importa — primero cuenta el
 * voto y después se pide el dato. Al revés, cada formulario que aparece antes
 * del gesto se lleva una parte de la gente.
 */
export function useApoyar(onApoyado?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: servicio.apoyarObra,
    onSuccess: (respuesta, obraId) => {
      if (!respuesta.success) {
        toast.error(mensajeDeError(respuesta.error_code));
        return;
      }

      // Apoyar es el momento que hay que celebrar: es lo que queremos que el
      // vecino repita y cuente. Se respeta a quien pidió menos animación.
      const menosMovimiento =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!menosMovimiento) {
        void confetti({
          particleCount: 60,
          spread: 65,
          startVelocity: 32,
          origin: { y: 0.7 },
          colors: ['#111111', '#4a4a4a', '#d9d9d9', '#ffffff'],
          disableForReducedMotion: true,
        });
      }

      queryClient.invalidateQueries({ queryKey: clavesObras.detalle(obraId) });
      queryClient.invalidateQueries({ queryKey: clavesObras.todo });
      onApoyado?.();
    },
    onError: () => toast.error('No pudimos registrar tu apoyo. Intenta otra vez.'),
  });
}

export function useQuitarApoyo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: servicio.quitarApoyo,
    onSuccess: (_respuesta, obraId) => {
      queryClient.invalidateQueries({ queryKey: clavesObras.detalle(obraId) });
      queryClient.invalidateQueries({ queryKey: clavesObras.todo });
      toast('Retiraste tu apoyo.');
    },
    onError: () => toast.error('No pudimos retirar tu apoyo. Intenta otra vez.'),
  });
}

/**
 * Publicar un pedido. Al terminar dispara el procesado de IA sin esperarlo: el
 * vecino ya está viendo la pantalla de confirmación mientras el servidor
 * transcribe y redacta para la cola del equipo.
 */
export function useCrearObra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: servicio.crearObra,
    onSuccess: (respuesta) => {
      if (!respuesta.success) {
        toast.error(mensajeDeError(respuesta.error_code));
        return;
      }
      if (respuesta.obra) servicio.pedirProcesadoIA(respuesta.obra.id);
      queryClient.invalidateQueries({ queryKey: clavesObras.todo });
    },
    onError: () => toast.error('No pudimos enviar tu pedido. Intenta otra vez.'),
  });
}

/**
 * Mis propuestas. `staleTime` corto: el vecino entra justo a ver si ya se la
 * aprobaron, y ahí un dato de hace diez minutos es lo mismo que ninguno.
 */
export function useMisPropuestas() {
  return useQuery({
    queryKey: [...clavesObras.todo, 'mias'],
    queryFn: servicio.traerMisPropuestas,
    staleTime: 30 * 1000,
  });
}
