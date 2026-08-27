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
      toast.success('Publicado. Ya se ve en el seguimiento de la obra.');
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
      if (!r.success) {
        toast.error(
          r.error_code === 'titulo_requerido'
            ? 'Ponle un título de al menos 8 letras antes de publicar.'
            : mensajeDeError(r.error_code),
        );
        return;
      }
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

export function useCanales(ciudadId: string) {
  return useQuery({
    queryKey: [...clavesPanel.todo, 'canales', ciudadId],
    queryFn: () => servicio.traerCanales(ciudadId),
    enabled: Boolean(ciudadId),
  });
}

export function useGuardarCanales(ciudadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (canales: { id: string; nombre: string; enlace_canal: string | null }[]) =>
      servicio.guardarCanales(ciudadId, canales),
    onSuccess: (r) => {
      if (!r.success) {
        toast.error(
          r.error_code === 'enlace_invalido'
            ? `El enlace de ${r.detalle ?? 'ese sector'} no es de WhatsApp. Copia el de «Invitar al canal».`
            : mensajeDeError(r.error_code),
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: [...clavesPanel.todo, 'canales', ciudadId] });
      toast.success('Enlaces guardados.');
    },
    onError: () => toast.error('No pudimos guardar los enlaces.'),
  });
}

/* ------------------------------------------------- portada y perfiles -- */

export function usePortalDelPanel(ciudadSlug: string) {
  return useQuery({
    queryKey: [...clavesPanel.todo, 'portal', ciudadSlug],
    queryFn: () => servicio.traerPortal(ciudadSlug),
    enabled: Boolean(ciudadSlug),
  });
}

export function useGuardarPortal(ciudadId: string, ciudadSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: Partial<servicio.DatosDelPortal>) => servicio.guardarPortal(ciudadId, datos),
    onSuccess: (r) => {
      if (!r.success) return toast.error(mensajeDeError(r.error_code));
      queryClient.invalidateQueries({ queryKey: [...clavesPanel.todo, 'portal', ciudadSlug] });
      // La portada la sirve el servidor: sin refrescar la ruta, el equipo
      // guarda y sigue viendo lo viejo al abrir el sitio en otra pestaña.
      toast.success('Portada guardada. Recarga el sitio para verla.');
    },
    onError: () => toast.error('No pudimos guardar la portada.'),
  });
}

export function usePerfiles(ciudadId: string) {
  return useQuery({
    queryKey: [...clavesPanel.todo, 'perfiles', ciudadId],
    queryFn: () => servicio.traerPerfiles(ciudadId),
    enabled: Boolean(ciudadId),
  });
}

export function useGuardarPerfiles(ciudadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (perfiles: servicio.PerfilDelEquipo[]) =>
      servicio.guardarPerfiles(ciudadId, perfiles),
    onSuccess: (r) => {
      if (!r.success) {
        toast.error(
          r.error_code === 'nombre_muy_corto'
            ? 'Cada perfil necesita un nombre.'
            : mensajeDeError(r.error_code),
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: [...clavesPanel.todo, 'perfiles', ciudadId] });
      toast.success('Perfiles guardados.');
    },
    onError: () => toast.error('No pudimos guardar los perfiles.'),
  });
}

export function useCrearObraDelEquipo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: servicio.crearObraDelEquipo,
    onSuccess: (r) => {
      if (!r.success) return toast.error(mensajeDeError(r.error_code));
      queryClient.invalidateQueries({ queryKey: clavesPanel.todo });
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      toast.success('Pedido publicado. Ya aparece en la lista con cero apoyos.');
    },
    onError: () => toast.error('No pudimos publicar el pedido.'),
  });
}
