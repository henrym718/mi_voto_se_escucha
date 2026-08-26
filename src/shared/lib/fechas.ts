import { differenceInDays, format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

/** "hace 3 días" — para la línea de tiempo de una obra. */
export function haceCuanto(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (isToday(d)) return 'hoy';
  if (isYesterday(d)) return 'ayer';
  return `hace ${formatDistanceToNowStrict(d, { locale: es })}`;
}

/** "4 de agosto de 2026" — cuando la fecha exacta importa. */
export function fechaLarga(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/** "4 ago" — para las etiquetas apretadas de las tarjetas. */
export function fechaCorta(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return format(d, 'd MMM', { locale: es });
}

export function diasDesde(fecha: string | Date): number {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return differenceInDays(new Date(), d);
}
