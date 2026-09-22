import { z } from 'zod';

/**
 * Tipos y esquemas transversales.
 *
 * Al compartirlos entre `apps/web` y `apps/api` el formulario del navegador y
 * el DTO del servidor validan con la MISMA regla. Eso evita la divergencia
 * clasica en la que el cliente acepta algo que el servidor rechaza, o peor, al
 * reves. Lo que no comparte es la confianza: el servidor **siempre** vuelve a
 * validar, porque todo lo que viene del navegador es editable por el usuario.
 */

/**
 * Identificador publico opaco (ULID de 26 caracteres en Crockford base32).
 *
 * SC-LAB-001 §3 lo deja explicito: los identificadores opacos dificultan la
 * enumeracion pero **no son un control de acceso**. Son defensa en
 * profundidad, nunca el reemplazo de la verificacion de propiedad.
 */
export const esquemaId = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'Identificador invalido');

export type Id = z.infer<typeof esquemaId>;

/** Correo institucional. El dominio permitido es configurable por entorno. */
export const esquemaCorreoInstitucional = z
  .string()
  .trim()
  .toLowerCase()
  .email('Correo electronico invalido')
  .max(254);

/**
 * Motivo obligatorio para operaciones sensibles (RNFS-062).
 *
 * El minimo de 10 caracteres no es decorativo: un campo que acepta "x" es un
 * campo que en la practica nadie llena, y una bitacora llena de motivos vacios
 * no permite reconstruir nada. El limite existe para que el registro sirva
 * cuando alguien tenga que leerlo meses despues.
 */
export const esquemaMotivo = z
  .string()
  .trim()
  .min(10, 'El motivo debe explicar la razon de la operacion (minimo 10 caracteres)')
  .max(500, 'El motivo no debe exceder 500 caracteres');

/** Paginacion con lista blanca de ordenamiento, para evitar inyeccion. */
export const esquemaPaginacion = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(25),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type Paginacion = z.infer<typeof esquemaPaginacion>;

export interface RespuestaPaginada<T> {
  readonly datos: readonly T[];
  readonly pagina: number;
  readonly tamano: number;
  readonly total: number;
}

/**
 * Forma unica de los errores de la API (RNFS-050).
 *
 * No incluye traza, consulta SQL, ruta interna ni detalle del recurso. Un 403
 * sobre un recurso ajeno y un 403 sobre un recurso inexistente producen
 * exactamente este mismo cuerpo, porque distinguirlos convertiria el endpoint
 * en un detector de existencia (RNFS-006).
 */
export const esquemaErrorApi = z.object({
  codigo: z.string(),
  mensaje: z.string(),
  correlationId: z.string(),
  // Solo para errores de validacion: que campo y por que. Nunca revela estado
  // del servidor.
  campos: z.record(z.string(), z.array(z.string())).optional(),
});

export type ErrorApi = z.infer<typeof esquemaErrorApi>;

/** Vigencia de una asignacion. `hasta === null` significa vigente. */
export const esquemaVigencia = z.object({
  desde: z.coerce.date(),
  hasta: z.coerce.date().nullable(),
});

export type Vigencia = z.infer<typeof esquemaVigencia>;
