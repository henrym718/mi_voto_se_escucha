import { supabaseNavegador } from '@/shared/lib/supabase/client';

import type {
  ObraDetalle,
  ObraSimilar,
  ObraResumen,
  ObrasFiltros,
  RespuestaApoyo,
} from '../types/obras.types';

/**
 * Ningún componente habla con Supabase: todo pasa por aquí, y de aquí solo se
 * llaman RPC. Las reglas de negocio (un apoyo por persona, solo en tu barrio)
 * viven en la base, no en el navegador, donde cualquiera las esquivaría.
 */

interface ListadoObras {
  success: boolean;
  error_code?: string;
  total: number;
  items: ObraResumen[];
}

export async function listarObras(
  ciudadSlug: string,
  filtros: ObrasFiltros = {},
): Promise<ListadoObras> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('obras_listar', {
    p_ciudad_slug: ciudadSlug,
    p_ciudadela_id: filtros.ciudadelaId ?? undefined,
    p_categoria_id: filtros.categoriaId ?? undefined,
    p_estado_id: filtros.estadoId ?? undefined,
    p_busqueda: filtros.busqueda ?? undefined,
    p_orden: filtros.orden ?? 'apoyos',
    p_limite: filtros.limite ?? 20,
    p_desde: filtros.desde ?? 0,
  });

  if (error) throw new Error(error.message);
  return data as unknown as ListadoObras;
}

export async function obtenerObra(params: { id?: string; codigo?: string }): Promise<ObraDetalle> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('obra_detalle', {
    p_obra_id: params.id ?? undefined,
    p_codigo: params.codigo ?? undefined,
  });

  if (error) throw new Error(error.message);
  const respuesta = data as unknown as { success: boolean; error_code?: string; obra?: ObraDetalle };
  if (!respuesta.success || !respuesta.obra) throw new Error(respuesta.error_code ?? 'obra_no_encontrada');
  return respuesta.obra;
}

export async function apoyarObra(obraId: string): Promise<RespuestaApoyo> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('obra_apoyar', { p_obra_id: obraId });
  if (error) throw new Error(error.message);
  return data as unknown as RespuestaApoyo;
}

export async function quitarApoyo(obraId: string): Promise<RespuestaApoyo> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('obra_quitar_apoyo', { p_obra_id: obraId });
  if (error) throw new Error(error.message);
  return data as unknown as RespuestaApoyo;
}

/** El corazón del anti-duplicados: qué existe ya antes de dejar escribir. */
export async function buscarSimilares(
  ciudadelaId: string,
  categoriaId: string,
): Promise<ObraSimilar[]> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('obras_similares', {
    p_ciudadela_id: ciudadelaId,
    p_categoria_id: categoriaId,
  });
  if (error) throw new Error(error.message);
  return ((data as unknown as { items?: ObraSimilar[] })?.items ?? []) as ObraSimilar[];
}

export async function crearObra(entrada: {
  ciudadelaId: string;
  categoriaId: string;
  titulo: string;
  descripcion?: string;
  fotoUrl?: string | null;
}): Promise<{ success: boolean; error_code?: string; obra?: { id: string; codigo: string }; mensaje?: string }> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('obra_crear', {
    p_ciudadela_id: entrada.ciudadelaId,
    p_categoria_id: entrada.categoriaId,
    p_titulo: entrada.titulo,
    p_descripcion: entrada.descripcion ?? '',
    p_foto_url: entrada.fotoUrl ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as never;
}

export async function rankingDeBarrio(ciudadelaId: string, limite = 5) {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('ranking_ciudadela', {
    p_ciudadela_id: ciudadelaId,
    p_limite: limite,
  });
  if (error) throw new Error(error.message);
  return data as unknown as {
    success: boolean;
    vecinos_ciudadela: number;
    items: (ObraSimilar & { posicion: number; categoria: { nombre: string; icono: string } })[];
  };
}
