import { z } from 'zod';
import { esquemaCorreoInstitucional, esquemaId } from './comunes.js';
import type { Permiso, RolBase } from './permisos.js';

/**
 * Contratos de identidad, sesion y recuperacion.
 * Requisitos: RF-001 a RF-006, RF-010, RNFS-010 a RNFS-025.
 */

/**
 * Politica de contrasenas (SC-LAB-001 escenario 3).
 *
 * Longitud minima alta y sin rotacion periodica obligatoria. La decision de no
 * forzar rotacion es deliberada y esta argumentada en SC-LAB-001 §4: la
 * evidencia actual indica que empuja a los usuarios a variaciones predecibles
 * y debilita el conjunto. Ese esfuerzo se invierte en MFA.
 *
 * Tampoco se exigen clases de caracteres. Producen contrasenas como
 * "Password1!" —que cumple toda regla y esta en cualquier diccionario— y
 * penalizan frases largas, que son mas fuertes. El contraste contra listas
 * filtradas lo hace el servidor, que es donde esta la lista.
 */
export const esquemaContrasena = z
  .string()
  .min(12, 'La contrasena debe tener al menos 12 caracteres')
  .max(128, 'La contrasena no debe exceder 128 caracteres');

export const esquemaSolicitudLogin = z.object({
  correo: esquemaCorreoInstitucional,
  contrasena: z.string().min(1).max(128),
  captcha: z.string().optional(),
});

export type SolicitudLogin = z.infer<typeof esquemaSolicitudLogin>;

/**
 * Resultado del primer paso de autenticacion.
 *
 * `mfa-requerido` no entrega sesion todavia: entrega un desafio de corta
 * vida. Si devolviera la sesion completa y luego pidiera el codigo, el segundo
 * factor seria decorativo.
 */
export const esquemaRespuestaLogin = z.discriminatedUnion('resultado', [
  z.object({
    resultado: z.literal('autenticado'),
    usuario: z.object({
      id: esquemaId,
      correo: z.string(),
      nombre: z.string(),
    }),
  }),
  z.object({
    resultado: z.literal('mfa-requerido'),
    desafio: z.string(),
    expiraEn: z.number().int(),
  }),
]);

export type RespuestaLogin = z.infer<typeof esquemaRespuestaLogin>;

export const esquemaVerificacionMfa = z.object({
  desafio: z.string().min(1),
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'El codigo debe tener 6 digitos'),
});

export const esquemaCodigoRecuperacionMfa = z.object({
  desafio: z.string().min(1),
  codigoRecuperacion: z.string().trim().min(8).max(32),
});

export const esquemaAltaMfa = z.object({
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'El codigo debe tener 6 digitos'),
});

export const esquemaRespuestaAltaMfa = z.object({
  // Se entrega una sola vez, al dar de alta. Despues solo vive cifrado en
  // reposo y ya no se puede recuperar (RNFS-017).
  secreto: z.string(),
  uriOtpauth: z.string(),
  codigosRecuperacion: z.array(z.string()),
});

/**
 * Cambio de contrasena autenticado (RF-005).
 *
 * Exige la contrasena actual: sin eso, una sesion robada bastaria para tomar
 * la cuenta de forma permanente, y el atacante ni siquiera necesitaria conocer
 * la credencial.
 */
export const esquemaCambioContrasena = z
  .object({
    contrasenaActual: z.string().min(1),
    contrasenaNueva: esquemaContrasena,
  })
  .refine((d) => d.contrasenaActual !== d.contrasenaNueva, {
    message: 'La contrasena nueva debe ser distinta de la actual',
    path: ['contrasenaNueva'],
  });

// --- Recuperacion de cuenta: RF-010 reescrito (SC-SRS-001 §5) --------------

export const esquemaSolicitudRecuperacion = z.object({
  correo: esquemaCorreoInstitucional,
  captcha: z.string().optional(),
});

/**
 * La respuesta a solicitar recuperacion NO lleva datos (RNFS-020).
 *
 * Es siempre el mismo objeto, exista o no la cuenta. Cualquier diferencia
 * —un campo de mas, un codigo distinto, una latencia notoria— convierte el
 * formulario en un enumerador de correos institucionales validos.
 */
export const esquemaRespuestaRecuperacion = z.object({
  mensaje: z.literal(
    'Si la cuenta existe, se envio un enlace de recuperacion al correo registrado.',
  ),
});

export const esquemaCompletarRecuperacion = z.object({
  token: z.string().min(32).max(256),
  contrasenaNueva: esquemaContrasena,
});

// --- Sesion ----------------------------------------------------------------

export interface SesionActiva {
  readonly id: string;
  readonly creadaEl: string;
  readonly ultimaActividadEl: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly esLaActual: boolean;
}

/**
 * Identidad del actor tal como el frontend la recibe.
 *
 * El frontend la usa **solo** para decidir que muestra. El servidor nunca lee
 * estos campos de la peticion: los recalcula desde la sesion en cada llamada
 * (RNFS-003). Si este objeto llegara alterado desde el navegador, no cambiaria
 * absolutamente nada del lado del servidor.
 */
export interface ActorPublico {
  readonly id: string;
  readonly correo: string;
  readonly nombre: string;
  readonly roles: readonly RolBase[];
  readonly permisos: readonly Permiso[];
  readonly mfaActivo: boolean;
  readonly mfaObligatorio: boolean;
  readonly programaId: string | null;
}
