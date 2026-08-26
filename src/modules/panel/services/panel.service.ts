import { supabaseNavegador } from '@/shared/lib/supabase/client';

export interface TarjetaTablero {
  id: string;
  codigo: string;
  titulo: string;
  apoyos: number;
  porcentaje_ciudadela: number;
  ciudadela: string;
  categoria: string;
  categoria_icono: string;
  dias_sin_cambio: number;
  tiene_media: boolean;
}

export interface ColumnaTablero {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  color: string;
  orden: number;
  es_compromiso: boolean;
  es_cierre_suave: boolean;
  notifica: boolean;
  total: number;
  obras: TarjetaTablero[];
}

export async function traerTablero(
  ciudadId: string,
  filtros: { ciudadelaId?: string | null; categoriaId?: string | null } = {},
): Promise<ColumnaTablero[]> {
  const { data, error } = await supabaseNavegador().rpc('admin_tablero', {
    p_ciudad_id: ciudadId,
    p_ciudadela_id: filtros.ciudadelaId ?? undefined,
    p_categoria_id: filtros.categoriaId ?? undefined,
  });
  if (error) throw new Error(error.message);
  const r = data as unknown as { success: boolean; error_code?: string; columnas?: ColumnaTablero[] };
  if (!r.success) throw new Error(r.error_code ?? 'error');
  return r.columnas ?? [];
}

export async function cambiarEstado(entrada: {
  obraId: string;
  estadoId: string;
  texto?: string;
  media?: { tipo: string; url: string }[];
  notificar?: boolean;
}) {
  const { data, error } = await supabaseNavegador().rpc('admin_obra_cambiar_estado', {
    p_obra_id: entrada.obraId,
    p_estado_id: entrada.estadoId,
    p_texto: entrada.texto ?? '',
    p_media: (entrada.media ?? []) as never,
    p_notificar: entrada.notificar ?? true,
  });
  if (error) throw new Error(error.message);
  return data as unknown as {
    success: boolean;
    error_code?: string;
    notificados?: number;
    estado?: { nombre: string; color: string };
  };
}

export interface PedidoEnCola {
  id: string;
  titulo: string;
  descripcion: string;
  foto_url: string | null;
  creada_en: string;
  ciudadela: string;
  ciudadela_id: string;
  categoria: string;
  categoria_id: string;
  similares: number;
}

export async function traerCola(ciudadId: string): Promise<PedidoEnCola[]> {
  const { data, error } = await supabaseNavegador().rpc('admin_cola_aprobacion', {
    p_ciudad_id: ciudadId,
  });
  if (error) throw new Error(error.message);
  return ((data as unknown as { items?: PedidoEnCola[] })?.items ?? []) as PedidoEnCola[];
}

export async function aprobarPedido(obraId: string) {
  const { data, error } = await supabaseNavegador().rpc('admin_obra_aprobar', { p_obra_id: obraId });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; error_code?: string };
}

export async function rechazarPedido(obraId: string, motivo: string) {
  const { data, error } = await supabaseNavegador().rpc('admin_obra_rechazar', {
    p_obra_id: obraId,
    p_motivo: motivo,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; error_code?: string };
}

export async function fusionarPedidos(destinoId: string, origenIds: string[]) {
  const { data, error } = await supabaseNavegador().rpc('admin_obras_fusionar', {
    p_destino_id: destinoId,
    p_origen_ids: origenIds,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; error_code?: string; apoyos_totales?: number };
}

export interface FilaRanking {
  id: string;
  nombre: string;
  verificado: boolean;
  vecinos: number;
  obras: number;
  apoyos: number;
  top: {
    id: string;
    titulo: string;
    apoyos: number;
    porcentaje: number;
    categoria: string;
    estado: string;
    estado_color: string;
  }[];
}

export async function traerRanking(ciudadId: string, categoriaId?: string | null) {
  const { data, error } = await supabaseNavegador().rpc('admin_ranking', {
    p_ciudad_id: ciudadId,
    p_categoria_id: categoriaId ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as {
    success: boolean;
    error_code?: string;
    ciudadelas: FilaRanking[];
    categorias: { id: string; nombre: string; icono: string; obras: number; apoyos: number }[];
    totales: { vecinos: number; obras: number; apoyos: number; en_cola: number };
  };
}

export async function guardarEstados(ciudadId: string, estados: unknown[]) {
  const { data, error } = await supabaseNavegador().rpc('admin_estados_guardar', {
    p_ciudad_id: ciudadId,
    p_estados: estados as never,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; error_code?: string };
}

export async function difundir(entrada: {
  ciudadId: string;
  mensaje: string;
  ciudadelaIds?: string[] | null;
  categoriaIds?: string[] | null;
  botonPath?: string | null;
  simular?: boolean;
}) {
  const { data, error } = await supabaseNavegador().rpc('admin_difundir', {
    p_ciudad_id: entrada.ciudadId,
    p_mensaje: entrada.mensaje,
    p_ciudadela_ids: entrada.ciudadelaIds ?? undefined,
    p_categoria_ids: entrada.categoriaIds ?? undefined,
    p_boton_path: entrada.botonPath ?? undefined,
    p_simular: entrada.simular ?? false,
  });
  if (error) throw new Error(error.message);
  return data as unknown as {
    success: boolean;
    error_code?: string;
    simulacion?: boolean;
    alcance?: number;
    encoladas?: number;
    frenados_por_tope?: number;
    costo_estimado?: number;
  };
}
