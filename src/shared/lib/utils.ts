import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 1.482 en vez de 1482: los números grandes se leen de un vistazo. */
export function cifra(n: number | null | undefined): string {
  return new Intl.NumberFormat('es-EC').format(n ?? 0);
}

/** 12,5 % con la coma decimal que usa Ecuador. */
export function porcentaje(n: number | null | undefined): string {
  return `${new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 }).format(n ?? 0)}%`;
}

/**
 * Acepta lo que el vecino escriba y devuelve E.164, o null si no es un celular
 * ecuatoriano. Espeja exactamente `normalizar_telefono` de la base: si una de
 * las dos cambia, la otra tiene que cambiar igual.
 */
export function normalizarTelefono(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('593') && d[3] === '9') return `+${d}`;
  if (d.length === 10 && d.startsWith('09')) return `+593${d.slice(1)}`;
  if (d.length === 9 && d.startsWith('9')) return `+593${d}`;
  return null;
}

/** 099 123 4567 — cómo lo lee alguien de aquí, no +593991234567. */
export function telefonoLegible(e164: string): string {
  const d = e164.replace(/\D/g, '');
  const n = d.startsWith('593') ? d.slice(3) : d;
  if (n.length !== 9) return e164;
  return `0${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}
