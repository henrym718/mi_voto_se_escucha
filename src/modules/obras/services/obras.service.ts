import { supabaseNavegador } from '@/shared/lib/supabase/client';

import type {
  ObraDetalle,
  ObraResumen,
  ObrasFiltros,
  RespuestaApoyo,
} from '../types/obras.types';

/**
 * Ningún componente habla con Supabase: todo pasa por aquí, y de aquí solo se
 * llaman RPC. Las reglas de negocio (un apoyo por persona, tres pedidos al día)
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
    p_limite: filtros.limite ?? 10,
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
  if (!respuesta.success || !respuesta.obra)
    throw new Error(respuesta.error_code ?? 'obra_no_encontrada');
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

export interface RespuestaPedido {
  success: boolean;
  error_code?: string;
  obra?: { id: string; codigo: string };
  enlace_canal?: string | null;
}

/**
 * Publica el pedido y devuelve al instante. El texto lo ordena el servidor
 * después, así que aquí no se espera a ninguna IA: el vecino ve su pantalla de
 * "recibido" en cuanto la fila entra en la base.
 */
export async function crearObra(entrada: {
  ciudadelaId: string;
  categoriaId: string;
  texto?: string | null;
  audioRuta?: string | null;
  fotoUrl?: string | null;
}): Promise<RespuestaPedido> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc('obra_crear', {
    p_ciudadela_id: entrada.ciudadelaId,
    p_categoria_id: entrada.categoriaId,
    p_texto: entrada.texto ?? undefined,
    p_audio_url: entrada.audioRuta ?? undefined,
    p_foto_url: entrada.fotoUrl ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as RespuestaPedido;
}

/**
 * Le pide al servidor que ordene el pedido. Se dispara sin esperar respuesta:
 * `keepalive` hace que la petición sobreviva aunque el vecino cierre la pestaña
 * en el mismo segundo, que es exactamente lo que hace la gente después de
 * enviar algo.
 */
export function pedirProcesadoIA(obraId: string): void {
  void fetch('/api/ia/procesar-pedido', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ obraId }),
    keepalive: true,
  }).catch(() => {
    // Si no sale, la obra queda 'pendiente' y el equipo la ve igual en la cola.
  });
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
    items: (ObraResumen & { posicion: number })[];
  };
}
