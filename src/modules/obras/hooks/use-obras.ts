'use client';

import {
  type QueryClient,
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

import * as servicio from '../services/obras.service';
import { type ObraResumen, type ObrasFiltros, mensajeDeError } from '../types/obras.types';

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

/** Lo que devuelve `listarObras`, para poder parchear la caché sin castear a `any`. */
interface ListaEnCache {
  total: number;
  items: ObraResumen[];
}

function esLista(dato: unknown): dato is ListaEnCache {
  return Boolean(dato) && Array.isArray((dato as ListaEnCache).items);
}

function esObra(dato: unknown): dato is ObraResumen {
  return Boolean(dato) && typeof (dato as ObraResumen).id === 'string';
}

/**
 * El mismo orden que aplica `obras_listar` en la base: apoyos, luego la más
 * nueva, luego el id. Se replica aquí para que la tarjeta se coloque al
 * instante en el puesto que le va a dar el servidor, y el refetch que llega
 * después no la vuelva a mover.
 */
function ordenarPorApoyos(items: ObraResumen[]): ObraResumen[] {
  return [...items].sort(
    (a, b) =>
      b.apoyos - a.apoyos ||
      Date.parse(b.creada_en) - Date.parse(a.creada_en) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Mueve el apoyo en todo lo que ya está en caché —listados, detalle, ranking—
 * antes de que conteste el servidor.
 *
 * Se hace por dos razones. La obvia: el botón responde en el acto y no hay un
 * segundo de duda en 3G. La importante: el reordenamiento ocurre en el mismo
 * gesto del dedo, así que la tarjeta se ve subir de puesto. Si se espera al
 * refetch, la lista salta sola medio segundo después y parece que se apoyó otra.
 *
 * Devuelve la foto de la caché anterior para poder deshacerlo si la RPC falla.
 */
function moverApoyoEnCache(queryClient: QueryClient, obraId: string, delta: 1 | -1) {
  const previos = queryClient.getQueriesData({ queryKey: clavesObras.todo });

  const parchear = (obra: ObraResumen): ObraResumen =>
    obra.id === obraId
      ? { ...obra, apoyos: Math.max(obra.apoyos + delta, 0), ya_apoyada: delta > 0 }
      : obra;

  for (const [clave, cache] of previos) {
    if (esLista(cache)) {
      const items = cache.items.map(parchear);
      // Solo se reordena un listado ordenado por apoyos y sin búsqueda: con
      // texto manda la relevancia, que aquí no se puede calcular.
      const filtros = clave[3] as ObrasFiltros | undefined;
      const porApoyos =
        clave[1] === 'lista' && (filtros?.orden ?? 'apoyos') === 'apoyos' && !filtros?.busqueda;
      queryClient.setQueryData(clave, {
        ...cache,
        items: porApoyos ? ordenarPorApoyos(items) : items,
      });
      continue;
    }

    if (Array.isArray(cache) && cache.every(esObra)) {
      queryClient.setQueryData(clave, (cache as ObraResumen[]).map(parchear));
      continue;
    }

    if (esObra(cache)) queryClient.setQueryData(clave, parchear(cache));
  }

  return previos;
}

type FotoDeCache = ReturnType<typeof moverApoyoEnCache>;

function restaurarCache(queryClient: QueryClient, previos?: FotoDeCache) {
  for (const [clave, cache] of previos ?? []) queryClient.setQueryData(clave, cache);
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
    onMutate: async (obraId) => {
      // Un refetch en vuelo aterrizaría encima del parche y devolvería la lista
      // a su orden viejo: se cancela antes de tocar la caché.
      await queryClient.cancelQueries({ queryKey: clavesObras.todo });
      return { previos: moverApoyoEnCache(queryClient, obraId, 1) };
    },
    onSuccess: (respuesta, obraId, contexto) => {
      if (!respuesta.success) {
        restaurarCache(queryClient, contexto?.previos);
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
    onError: (_error, _obraId, contexto) => {
      restaurarCache(queryClient, contexto?.previos);
      toast.error('No pudimos registrar tu apoyo. Intenta otra vez.');
    },
  });
}

export function useQuitarApoyo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: servicio.quitarApoyo,
    onMutate: async (obraId) => {
      await queryClient.cancelQueries({ queryKey: clavesObras.todo });
      return { previos: moverApoyoEnCache(queryClient, obraId, -1) };
    },
    onSuccess: (respuesta, obraId, contexto) => {
      if (!respuesta.success) {
        restaurarCache(queryClient, contexto?.previos);
        toast.error(mensajeDeError(respuesta.error_code));
        return;
      }
      queryClient.invalidateQueries({ queryKey: clavesObras.detalle(obraId) });
      queryClient.invalidateQueries({ queryKey: clavesObras.todo });
      toast('Retiraste tu apoyo.');
    },
    onError: (_error, _obraId, contexto) => {
      restaurarCache(queryClient, contexto?.previos);
      toast.error('No pudimos retirar tu apoyo. Intenta otra vez.');
    },
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
