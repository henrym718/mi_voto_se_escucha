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
  similares: (ciudadela: string, categoria: string) =>
    [...clavesObras.todo, 'similares', ciudadela, categoria] as const,
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
    queryKey: params.id ? clavesObras.detalle(params.id) : clavesObras.porCodigo(params.codigo ?? ''),
    queryFn: () => servicio.obtenerObra(params),
    enabled: habilitada && Boolean(params.id || params.codigo),
  });
}

export function useSimilares(ciudadelaId?: string | null, categoriaId?: string | null) {
  return useQuery({
    queryKey: clavesObras.similares(ciudadelaId ?? '', categoriaId ?? ''),
    queryFn: () => servicio.buscarSimilares(ciudadelaId!, categoriaId!),
    enabled: Boolean(ciudadelaId && categoriaId),
  });
}

export function useRankingBarrio(ciudadelaId?: string | null, limite = 5) {
  return useQuery({
    queryKey: clavesObras.ranking(ciudadelaId ?? ''),
    queryFn: () => servicio.rankingDeBarrio(ciudadelaId!, limite),
    enabled: Boolean(ciudadelaId),
  });
}

/** Códigos que solo significan "este vecino todavía no está identificado". */
const FALTA_IDENTIFICARSE = ['sin_sesion', 'vecino_no_registrado'];

export function useApoyar(onSinSesion?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: servicio.apoyarObra,
    onSuccess: (respuesta, obraId) => {
      if (!respuesta.success) {
        // La sesión puede haberse vencido entre que cargó la página y el
        // vecino tocó Apoyar. Ahí un aviso es un callejón sin salida: lo que
        // hace falta es volver a pedirle el número y seguir donde estaba.
        if (FALTA_IDENTIFICARSE.includes(respuesta.error_code ?? '')) {
          queryClient.invalidateQueries({ queryKey: ['identidad'] });
          onSinSesion?.();
          return;
        }
        toast.error(mensajeDeError(respuesta.error_code));
        return;
      }

      // Apoyar es el momento que hay que celebrar: es lo que queremos que el
      // vecino repita y cuente. Se respeta quien pidió menos animación.
      const menosMovimiento =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!menosMovimiento) {
        void confetti({
          particleCount: 60,
          spread: 65,
          startVelocity: 32,
          origin: { y: 0.7 },
          colors: ['#0d7d6c', '#c98a12', '#ddf2e7', '#fff3d6'],
          disableForReducedMotion: true,
        });
      }

      toast.success(
        respuesta.posicion_ciudadela && respuesta.posicion_ciudadela <= 3
          ? `¡Listo! Esta obra va #${respuesta.posicion_ciudadela} en tu ciudadela.`
          : 'Listo, tu apoyo quedó registrado.',
      );

      queryClient.invalidateQueries({ queryKey: clavesObras.detalle(obraId) });
      queryClient.invalidateQueries({ queryKey: clavesObras.todo });
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

export function useCrearObra(onSinSesion?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: servicio.crearObra,
    onSuccess: (respuesta) => {
      if (!respuesta.success) {
        if (FALTA_IDENTIFICARSE.includes(respuesta.error_code ?? '')) {
          queryClient.invalidateQueries({ queryKey: ['identidad'] });
          onSinSesion?.();
          return;
        }
        toast.error(mensajeDeError(respuesta.error_code));
        return;
      }
      queryClient.invalidateQueries({ queryKey: clavesObras.todo });
      toast.success(respuesta.mensaje ?? 'Tu pedido entró a revisión.');
    },
    onError: () => toast.error('No pudimos publicar tu pedido. Intenta otra vez.'),
  });
}
