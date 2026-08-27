/**
 * Tipos del módulo. Se derivan de lo que devuelven las RPC, que es JSON: los
 * tipos generados de Supabase describen las TABLAS, no la forma del JSON de
 * salida, así que estas son las formas de verdad que consume la interfaz.
 */

export interface Referencia {
  id: string;
  nombre: string;
  slug?: string;
  icono?: string;
  color?: string;
}

export interface EstadoObra extends Referencia {
  color: string;
  descripcion?: string;
  es_compromiso?: boolean;
}

export interface ObraResumen {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  foto_url: string | null;
  apoyos: number;
  origen: 'vecino' | 'pdot' | 'equipo';
  fuente: string | null;
  creada_en: string;
  actualizada_en: string;
  ciudadela: Referencia;
  categoria: Referencia;
  estado: EstadoObra;
  ya_apoyada: boolean;
}

export interface EntradaLinea {
  id: string;
  texto: string;
  media: { tipo: 'foto' | 'video'; url: string; miniatura?: string }[];
  creada_en: string;
  estado: { nombre: string; slug: string; color: string } | null;
}

export interface ObraDetalle extends ObraResumen {
  aprobada: boolean;
  ciudad: { slug: string; nombre: string };
  ciudadela: Referencia & { enlace_canal?: string | null };
  linea_tiempo: EntradaLinea[];
}

export interface ObrasFiltros {
  ciudadelaId?: string | null;
  categoriaId?: string | null;
  estadoId?: string | null;
  busqueda?: string | null;
  orden?: 'apoyos' | 'recientes' | 'movimiento';
  limite?: number;
  desde?: number;
}

export interface RespuestaApoyo {
  success: boolean;
  error_code?: string;
  apoyos?: number;
}

/** Los códigos de error de las RPC, traducidos a algo que el vecino entienda. */
export const MENSAJES_ERROR: Record<string, string> = {
  sin_sesion: 'Recarga la página e intenta otra vez.',
  vecino_no_registrado: 'Recarga la página e intenta otra vez.',
  obra_no_disponible: 'Esta obra ya no está disponible.',
  obra_no_encontrada: 'No encontramos esa obra.',
  sin_contenido: 'Cuéntanos qué hace falta: grábalo o escríbelo.',
  ciudadela_invalida: 'Elige tu sector de la lista.',
  categoria_invalida: 'Elige una categoría de la lista.',
  demasiados_pedidos_hoy: 'Ya publicaste 3 pedidos hoy. Mañana puedes seguir.',
  ciudad_no_encontrada: 'No encontramos esta ciudad.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  sin_estado_inicial: 'La ciudad todavía no está configurada. Avísale al equipo.',
};

export function mensajeDeError(codigo?: string | null): string {
  if (!codigo) return 'Algo salió mal. Intenta de nuevo.';
  return MENSAJES_ERROR[codigo] ?? 'Algo salió mal. Intenta de nuevo.';
}
