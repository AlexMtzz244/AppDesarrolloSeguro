import { z } from 'zod';
import { esquemaId, esquemaMotivo } from './comunes.js';

/**
 * Contratos de calificaciones. Requisitos RF-040 a RF-046.
 *
 * El activo de mayor valor institucional del sistema (SC-LAB-001 §5.5): un
 * dato personal filtrado es grave, pero el titulo sigue siendo valido; una
 * calificacion alterada sin rastro invalida la certificacion misma, que es lo
 * unico que la universidad realmente emite.
 */

export const ESTADOS_CALIFICACION = ['borrador', 'publicado', 'corregido'] as const;
export type EstadoCalificacion = (typeof ESTADOS_CALIFICACION)[number];

/**
 * Transiciones permitidas de la maquina de estados.
 *
 * Nota que `publicado -> publicado` no existe: una calificacion publicada no
 * se actualiza en su sitio. La unica salida es `corregido`, que exige permiso
 * distinto, motivo obligatorio y conserva la version previa (RF-044).
 *
 * Y `corregido` no tiene salida alguna: se corrige creando una correccion
 * nueva sobre ella, nunca deshaciendo la anterior. El historial no retrocede.
 */
export const TRANSICIONES_CALIFICACION: Readonly<
  Record<EstadoCalificacion, readonly EstadoCalificacion[]>
> = {
  borrador: ['borrador', 'publicado'],
  publicado: ['corregido'],
  corregido: ['corregido'],
};

export function transicionPermitida(
  desde: EstadoCalificacion,
  hacia: EstadoCalificacion,
): boolean {
  return TRANSICIONES_CALIFICACION[desde].includes(hacia);
}

/**
 * Escala 0-100 como valor por defecto seguro (D-03, pendiente de aprobacion
 * por direccion academica). No se inventa ninguna regla de aprobacion,
 * redondeo ni ponderacion: eso es reglamento institucional, no codigo.
 */
export const esquemaValorCalificacion = z
  .number()
  .min(0, 'La calificacion minima es 0')
  .max(100, 'La calificacion maxima es 100')
  .multipleOf(0.01);

export const esquemaCapturarCalificacion = z.object({
  grupoId: esquemaId,
  estudianteId: esquemaId,
  valor: esquemaValorCalificacion,
});

export type CapturarCalificacion = z.infer<typeof esquemaCapturarCalificacion>;

/** Captura por lote para un grupo completo, en una sola transaccion. */
export const esquemaCapturaLote = z.object({
  grupoId: esquemaId,
  calificaciones: z
    .array(
      z.object({
        estudianteId: esquemaId,
        valor: esquemaValorCalificacion,
      }),
    )
    .min(1)
    .max(200),
});

export const esquemaPublicarCalificaciones = z.object({
  grupoId: esquemaId,
  calificacionIds: z.array(esquemaId).min(1).max(200),
});

/**
 * Correccion de una calificacion ya publicada (RF-044).
 *
 * El motivo es obligatorio a nivel de tipo, no como validacion opcional: no
 * existe forma de construir esta peticion sin el. La notificacion al
 * estudiante la dispara el servidor siempre, y no es un parametro que el
 * solicitante pueda desactivar — convertir al afectado en un detector
 * independiente solo funciona si no se puede silenciar (SC-LAB-001 esc. 1).
 */
export const esquemaCorregirCalificacion = z.object({
  calificacionId: esquemaId,
  valorNuevo: esquemaValorCalificacion,
  motivo: esquemaMotivo,
});

export type CorregirCalificacion = z.infer<typeof esquemaCorregirCalificacion>;

export interface VersionCalificacion {
  readonly version: number;
  readonly valor: number;
  readonly estado: EstadoCalificacion;
  readonly autorId: string;
  readonly motivo: string | null;
  readonly creadaEl: string;
}

export interface CalificacionDetalle {
  readonly id: string;
  readonly grupoId: string;
  readonly estudianteId: string;
  readonly valor: number;
  readonly estado: EstadoCalificacion;
  readonly versionActual: number;
  readonly actualizadaEl: string;
  readonly historial: readonly VersionCalificacion[];
}
