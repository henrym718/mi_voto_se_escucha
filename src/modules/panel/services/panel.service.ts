import { supabaseNavegador } from '@/shared/lib/supabase/client';

export interface TarjetaTablero {
  id: string;
  codigo: string;
  titulo: string;
  apoyos: number;
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
}) {
  const { data, error } = await supabaseNavegador().rpc('admin_obra_cambiar_estado', {
    p_obra_id: entrada.obraId,
    p_estado_id: entrada.estadoId,
    p_texto: entrada.texto ?? '',
    p_media: (entrada.media ?? []) as never,
  });
  if (error) throw new Error(error.message);
  return data as unknown as {
    success: boolean;
    error_code?: string;
    estado?: { nombre: string; color: string };
  };
}

export interface ObraParecida {
  id: string;
  titulo: string;
  apoyos: number;
  categoria: string;
  /** 0-100. Cuánto se parece al pedido nuevo, según el trigram del título. */
  parecido: number;
}

export interface PedidoEnCola {
  id: string;
  /** Lo que la IA propuso. Nulo mientras no la ha procesado o si falló. */
  titulo: string | null;
  descripcion: string;
  /** Lo que el vecino escribió, tal cual. */
  texto_original: string | null;
  /** Lo que Whisper oyó en la nota de voz. */
  transcripcion: string | null;
  /** Ruta en el bucket privado; se abre con enlace firmado. */
  audio_url: string | null;
  foto_url: string | null;
  ia_estado: 'no_aplica' | 'pendiente' | 'listo' | 'fallido';
  creada_en: string;
  ciudadela: string;
  ciudadela_id: string;
  categoria: string;
  categoria_id: string;
  parecidas: ObraParecida[];
}

export async function traerCola(ciudadId: string): Promise<PedidoEnCola[]> {
  const { data, error } = await supabaseNavegador().rpc('admin_cola_aprobacion', {
    p_ciudad_id: ciudadId,
  });
  if (error) throw new Error(error.message);
  return ((data as unknown as { items?: PedidoEnCola[] })?.items ?? []) as PedidoEnCola[];
}

/**
 * Aprobar publica lo que el equipo tiene delante: si ajustó el título que
 * propuso la IA, ese ajuste viaja en la misma llamada. Un clic, un viaje.
 */
export async function aprobarPedido(entrada: {
  obraId: string;
  titulo?: string;
  descripcion?: string;
  categoriaId?: string | null;
}) {
  const { data, error } = await supabaseNavegador().rpc('admin_obra_aprobar', {
    p_obra_id: entrada.obraId,
    p_titulo: entrada.titulo ?? undefined,
    p_descripcion: entrada.descripcion ?? undefined,
    p_categoria_id: entrada.categoriaId ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; error_code?: string };
}

/**
 * Enlace temporal para escuchar la nota de voz. El bucket es privado: es la voz
 * de una persona, no un archivo público del sitio.
 */
export async function enlaceDeNota(ruta: string): Promise<string | null> {
  const { data, error } = await supabaseNavegador()
    .storage.from('notas')
    .createSignedUrl(ruta, 60 * 30);
  if (error) return null;
  return data.signedUrl;
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
    apoyos_locales: number;
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
    totales: { vecinos: number; contactos: number; obras: number; apoyos: number; en_cola: number };
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

export interface CanalDeSector {
  id: string;
  nombre: string;
  enlace_canal: string | null;
  contactos: number;
  esperando: number;
}

export async function traerCanales(ciudadId: string): Promise<CanalDeSector[]> {
  const { data, error } = await supabaseNavegador().rpc('admin_canales_listar', {
    p_ciudad_id: ciudadId,
  });
  if (error) throw new Error(error.message);
  return ((data as unknown as { items?: CanalDeSector[] })?.items ?? []) as CanalDeSector[];
}

export async function guardarCanales(
  ciudadId: string,
  canales: { id: string; nombre: string; enlace_canal: string | null }[],
) {
  const { data, error } = await supabaseNavegador().rpc('admin_canales_guardar', {
    p_ciudad_id: ciudadId,
    p_canales: canales as never,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; error_code?: string; detalle?: string; sectores?: number };
}

export interface ContactoDeSector {
  telefono: string;
  quiere_canal: boolean;
  apoyos: number;
  desde: string;
}

export async function traerContactos(ciudadelaId: string, soloCanal = false) {
  const { data, error } = await supabaseNavegador().rpc('admin_contactos_sector', {
    p_ciudadela_id: ciudadelaId,
    p_solo_canal: soloCanal,
  });
  if (error) throw new Error(error.message);
  const r = data as unknown as { success: boolean; error_code?: string; items?: ContactoDeSector[] };
  if (!r.success) throw new Error(r.error_code ?? 'error');
  return r.items ?? [];
}

/* ------------------------------------------------- portada y perfiles -- */

export interface DatosDelPortal {
  candidato_nombre: string;
  candidato_cargo: string;
  partido: string;
  cedula: string | null;
  eslogan: string;
  hero_subtitulo: string;
  hero_medio: 'foto' | 'video';
  bio: string;
  foto_url: string | null;
  foto_hero_url: string | null;
  banner_url: string | null;
  video_url: string | null;
  video_portada_url: string | null;
  logo_url: string | null;
  color_marca: string;
  redes: Record<string, string>;
}

/** El portal se lee con la misma RPC pública que pinta la portada: una sola
 *  fuente de verdad, y así el panel enseña exactamente lo que ve el vecino. */
export async function traerPortal(ciudadSlug: string): Promise<DatosDelPortal | null> {
  const { data, error } = await supabaseNavegador().rpc('ciudad_portada', {
    p_ciudad_slug: ciudadSlug,
  });
  if (error) throw new Error(error.message);
  const r = data as unknown as { success: boolean; portal?: DatosDelPortal } | null;
  return r?.portal ?? null;
}

export async function guardarPortal(ciudadId: string, datos: Partial<DatosDelPortal>) {
  const { data, error } = await supabaseNavegador().rpc('admin_portal_guardar', {
    p_ciudad_id: ciudadId,
    p_datos: datos as never,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; error_code?: string };
}

export interface PerfilDelEquipo {
  id: string | null;
  slug?: string;
  nombre: string;
  cargo: string;
  cedula: string | null;
  foto_url: string | null;
  bio: string;
  telefono: string | null;
  correo: string | null;
  redes: Record<string, string>;
  es_candidato: boolean;
}

export async function traerPerfiles(ciudadId: string): Promise<PerfilDelEquipo[]> {
  const { data, error } = await supabaseNavegador().rpc('admin_perfiles_listar', {
    p_ciudad_id: ciudadId,
  });
  if (error) throw new Error(error.message);
  const r = data as unknown as { success: boolean; items?: PerfilDelEquipo[] };
  return r?.items ?? [];
}

export async function guardarPerfiles(ciudadId: string, perfiles: PerfilDelEquipo[]) {
  const { data, error } = await supabaseNavegador().rpc('admin_perfiles_guardar', {
    p_ciudad_id: ciudadId,
    p_perfiles: perfiles as never,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; error_code?: string };
}

/* --------------------------------------------- pedido levantado por el equipo -- */

export async function crearObraDelEquipo(entrada: {
  ciudadelaId: string;
  categoriaId: string;
  titulo: string;
  descripcion: string;
  fotoUrl?: string | null;
  fuente?: string | null;
}) {
  const { data, error } = await supabaseNavegador().rpc('admin_obra_crear', {
    p_ciudadela_id: entrada.ciudadelaId,
    p_categoria_id: entrada.categoriaId,
    p_titulo: entrada.titulo,
    p_descripcion: entrada.descripcion,
    p_foto_url: entrada.fotoUrl ?? undefined,
    p_fuente: entrada.fuente ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as {
    success: boolean;
    error_code?: string;
    obra?: { id: string; codigo: string; aprobada: boolean };
  };
}
