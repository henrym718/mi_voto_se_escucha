'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { mensajeDeError } from '@/modules/obras/types/obras.types';

import * as servicio from '../services/panel.service';

export const clavesPanel = {
  todo: ['panel'] as const,
  tablero: (ciudad: string, filtros: unknown) => [...clavesPanel.todo, 'tablero', ciudad, filtros] as const,
  cola: (ciudad: string) => [...clavesPanel.todo, 'cola', ciudad] as const,
  ranking: (ciudad: string, categoria?: string | null) =>
    [...clavesPanel.todo, 'ranking', ciudad, categoria ?? null] as const,
};

export function useTablero(
  ciudadId: string,
  filtros: { ciudadelaId?: string | null; categoriaId?: string | null } = {},
) {
  return useQuery({
    queryKey: clavesPanel.tablero(ciudadId, filtros),
    queryFn: () => servicio.traerTablero(ciudadId, filtros),
    enabled: Boolean(ciudadId),
  });
}

export function useCambiarEstado(ciudadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: servicio.cambiarEstado,
    onSuccess: (respuesta) => {
      if (!respuesta.success) {
        toast.error(mensajeDeError(respuesta.error_code));
        return;
      }
      queryClient.invalidateQueries({ queryKey: clavesPanel.tablero(ciudadId, {}) });
      queryClient.invalidateQueries({ queryKey: clavesPanel.todo });
      queryClient.invalidateQueries({ queryKey: ['obras'] });

      // Decir a cuánta gente se le avisó es lo que hace tangible el valor del
      // producto para el comando: acaban de tocar 287 teléfonos reales.
      toast.success(
        respuesta.notificados
          ? `Publicado. Se avisará por WhatsApp a ${respuesta.notificados} ${
              respuesta.notificados === 1 ? 'vecino' : 'vecinos'
            }.`
          : 'Publicado sin enviar avisos.',
      );
    },
    onError: () => toast.error('No pudimos guardar el cambio.'),
  });
}

export function useCola(ciudadId: string) {
  return useQuery({
    queryKey: clavesPanel.cola(ciudadId),
    queryFn: () => servicio.traerCola(ciudadId),
    enabled: Boolean(ciudadId),
  });
}

export function useAprobar(ciudadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: servicio.aprobarPedido,
    onSuccess: (r) => {
      if (!r.success) return toast.error(mensajeDeError(r.error_code));
      queryClient.invalidateQueries({ queryKey: clavesPanel.cola(ciudadId) });
      queryClient.invalidateQueries({ queryKey: clavesPanel.todo });
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      toast.success('Pedido publicado.');
    },
  });
}

export function useRechazar(ciudadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ obraId, motivo }: { obraId: string; motivo: string }) =>
      servicio.rechazarPedido(obraId, motivo),
    onSuccess: (r) => {
      if (!r.success) return toast.error(mensajeDeError(r.error_code));
      queryClient.invalidateQueries({ queryKey: clavesPanel.cola(ciudadId) });
      queryClient.invalidateQueries({ queryKey: clavesPanel.todo });
      toast('Pedido descartado.');
    },
  });
}

export function useFusionar(ciudadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ destinoId, origenIds }: { destinoId: string; origenIds: string[] }) =>
      servicio.fusionarPedidos(destinoId, origenIds),
    onSuccess: (r) => {
      if (!r.success) return toast.error(mensajeDeError(r.error_code));
      queryClient.invalidateQueries({ queryKey: clavesPanel.cola(ciudadId) });
      queryClient.invalidateQueries({ queryKey: clavesPanel.todo });
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      toast.success(`Unidos. La obra queda con ${r.apoyos_totales} apoyos.`);
    },
  });
}

export function useRanking(ciudadId: string, categoriaId?: string | null) {
  return useQuery({
    queryKey: clavesPanel.ranking(ciudadId, categoriaId),
    queryFn: () => servicio.traerRanking(ciudadId, categoriaId),
    enabled: Boolean(ciudadId),
  });
}

export function useGuardarEstados(ciudadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (estados: unknown[]) => servicio.guardarEstados(ciudadId, estados),
    onSuccess: (r) => {
      if (!r.success) {
        toast.error(
          r.error_code === 'debe_haber_un_estado_inicial'
            ? 'Tiene que haber exactamente un estado inicial.'
            : mensajeDeError(r.error_code),
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: clavesPanel.todo });
      queryClient.invalidateQueries({ queryKey: ['catalogo'] });
      toast.success('Estados guardados.');
    },
  });
}

export function useDifundir() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: servicio.difundir,
    onSuccess: (r) => {
      if (!r.success) return toast.error(mensajeDeError(r.error_code));
      if (r.simulacion) return;
      queryClient.invalidateQueries({ queryKey: clavesPanel.todo });
      toast.success(
        r.frenados_por_tope
          ? `${r.encoladas} mensajes en camino. ${r.frenados_por_tope} vecinos quedaron fuera por el tope semanal.`
          : `${r.encoladas} mensajes en camino.`,
      );
    },
  });
}
