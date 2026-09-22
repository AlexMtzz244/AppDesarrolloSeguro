import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  return FORMATO_FECHA.format(new Date(iso));
}

export function bytes(cantidad: number): string {
  if (cantidad < 1024) return `${cantidad} B`;
  if (cantidad < 1024 ** 2) return `${(cantidad / 1024).toFixed(1)} KB`;
  return `${(cantidad / 1024 ** 2).toFixed(1)} MB`;
}
