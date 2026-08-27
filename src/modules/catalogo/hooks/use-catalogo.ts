'use client';

import { useQuery } from '@tanstack/react-query';

import { supabaseNavegador } from '@/shared/lib/supabase/client';

/** Catálogo de la ciudad: ciudadelas, categorías y estados. Cambia casi nunca. */
export const clavesCatalogo = {
  todo: ['catalogo'] as const,
  ciudadelas: (ciudadId: string) => [...clavesCatalogo.todo, 'ciudadelas', ciudadId] as const,
  categorias: (ciudadId: string) => [...clavesCatalogo.todo, 'categorias', ciudadId] as const,
  estados: (ciudadId: string) => [...clavesCatalogo.todo, 'estados', ciudadId] as const,
};

export interface Ciudadela {
  id: string;
  nombre: string;
  slug: string;
  zona: string;
  verificado: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  icono: string;
  color: string;
  orden: number;
}

export interface Estado {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  color: string;
  orden: number;
  es_inicial: boolean;
  es_compromiso: boolean;
  es_cierre_suave: boolean;
}

const UNA_HORA = 60 * 60 * 1000;

export function useCiudadelas(ciudadId: string) {
  return useQuery({
    queryKey: clavesCatalogo.ciudadelas(ciudadId),
    queryFn: async (): Promise<Ciudadela[]> => {
      const { data, error } = await supabaseNavegador()
        .from('ciudadelas')
        .select('id, nombre, slug, zona, verificado')
        .eq('ciudad_id', ciudadId)
        .eq('activa', true)
        .order('orden');
      if (error) throw new Error(error.message);
      return data as Ciudadela[];
    },
    staleTime: UNA_HORA,
    enabled: Boolean(ciudadId),
  });
}

export function useCategorias(ciudadId: string) {
  return useQuery({
    queryKey: clavesCatalogo.categorias(ciudadId),
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabaseNavegador()
        .from('categorias')
        .select('id, nombre, slug, icono, color, orden')
        .eq('ciudad_id', ciudadId)
        .eq('activa', true)
        .order('orden');
      if (error) throw new Error(error.message);
      return data as Categoria[];
    },
    staleTime: UNA_HORA,
    enabled: Boolean(ciudadId),
  });
}

export function useEstados(ciudadId: string) {
  return useQuery({
    queryKey: clavesCatalogo.estados(ciudadId),
    queryFn: async (): Promise<Estado[]> => {
      const { data, error } = await supabaseNavegador()
        .from('estados')
        .select('*')
        .eq('ciudad_id', ciudadId)
        .eq('activo', true)
        .order('orden');
      if (error) throw new Error(error.message);
      return data as Estado[];
    },
    staleTime: UNA_HORA,
    enabled: Boolean(ciudadId),
  });
}
