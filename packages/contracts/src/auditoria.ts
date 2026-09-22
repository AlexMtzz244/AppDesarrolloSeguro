import { z } from 'zod';
import { esquemaId, esquemaPaginacion } from './comunes.js';

/**
 * Contratos de auditoria, alertas y notificaciones.
 * Requisitos RF-080, RF-081, RF-090, RF-091, RNFS-030 a RNFS-033.
 */

export const RESULTADOS_AUDITORIA = ['exito', 'denegado', 'error'] as const;
export type ResultadoAuditoria = (typeof RESULTADOS_AUDITORIA)[number];

/**
 * Acciones auditables.
 *
 * Es una lista cerrada para que la bitacora sea consultable con filtros
 * fiables. Una accion nueva obliga a agregarla aqui, lo que en la practica
 * funciona como recordatorio de que esa operacion tambien debe auditarse.
 */
export const ACCIONES_AUDITABLES = [
  'sesion.inicio',
  'sesion.cierre',
  'sesion.revocacion',
  'sesion.revocacion-global',
  'autenticacion.fallida',
  'mfa.alta',
  'mfa.baja',
  'contrasena.cambio',
  'recuperacion.solicitud',
  'recuperacion.completada',
  'perfil.lectura',
  'perfil.modificacion',
  'usuario.alta',
  'usuario.modificacion',
  'usuario.desactivacion',
  'rol.asignacion',
  'rol.revocacion',
  'permiso.cambio',
  'programa.cambio',
  'periodo.cierre',
  'periodo.cambio-retroactivo',
  'grupo.alta',
  'grupo.modificacion',
  'asignacion-docente.alta',
  'asignacion-docente.cierre',
  'calificacion.captura',
  'calificacion.publicacion',
  'calificacion.correccion',
  'documento.carga',
  'documento.descarga',
  'documento.cuarentena',
  'solicitud.alta',
  'solicitud.cambio-estado',
  'acceso.denegado',
] as const;

export type AccionAuditable = (typeof ACCIONES_AUDITABLES)[number];

/**
 * Un evento de auditoria tal como se consulta (RNFS-032).
 *
 * Nota que no existe un tipo `ActualizarEventoAuditoria` ni
 * `EliminarEventoAuditoria`, y no es un olvido: la API no ofrece esas
 * operaciones (RF-081), y la base de datos tampoco las permite al rol de
 * aplicacion (RNFS-031). Que el tipo no exista es la primera de esas tres
 * capas.
 */
export interface EventoAuditoria {
  readonly id: string;
  readonly creadoEl: string;
  readonly actorId: string | null;
  readonly actorCorreo: string | null;
  readonly accion: AccionAuditable;
  readonly tipoRecurso: string;
  readonly recursoId: string | null;
  readonly resultado: ResultadoAuditoria;
  readonly motivo: string | null;
  readonly antes: unknown | null;
  readonly despues: unknown | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly correlationId: string;
}

/** Filtros de consulta, todos con lista blanca para evitar inyeccion. */
export const esquemaFiltroAuditoria = esquemaPaginacion.extend({
  actorId: esquemaId.optional(),
  accion: z.enum(ACCIONES_AUDITABLES).optional(),
  tipoRecurso: z.string().trim().max(60).optional(),
  recursoId: esquemaId.optional(),
  resultado: z.enum(RESULTADOS_AUDITORIA).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  ordenarPor: z.enum(['creadoEl', 'accion', 'resultado']).default('creadoEl'),
});

export type FiltroAuditoria = z.infer<typeof esquemaFiltroAuditoria>;

// --- Alertas (RF-090) ------------------------------------------------------

/**
 * Las siete reglas de alerta.
 *
 * Las dos ultimas son las que cierran el escenario 5 de SC-LAB-001, donde el
 * control prioritario es detectivo y no preventivo: contra un jefe de carrera
 * que actua dentro de sus atribuciones formales la prevencion tiene poco
 * margen —su trabajo *es* asignar profesores— y lo que queda es que el paso
 * intermedio sea visible.
 */
export const TIPOS_ALERTA = [
  'rafaga-403',
  'descargas-masivas',
  'acceso-inusual',
  'correcciones-anormales',
  'cambio-privilegio',
  'captura-inmediata-tras-asignacion',
  'asignacion-revertida-pronto',
] as const;

export type TipoAlerta = (typeof TIPOS_ALERTA)[number];

export const SEVERIDADES_ALERTA = ['baja', 'media', 'alta', 'critica'] as const;
export type SeveridadAlerta = (typeof SEVERIDADES_ALERTA)[number];

export interface Alerta {
  readonly id: string;
  readonly tipo: TipoAlerta;
  readonly severidad: SeveridadAlerta;
  readonly detalle: string;
  readonly eventoAuditoriaId: string | null;
  readonly sujetoId: string | null;
  readonly creadaEl: string;
  readonly atendidaEl: string | null;
}

// --- Notificaciones (RF-091) ----------------------------------------------

export const CANALES_NOTIFICACION = ['correo', 'en-aplicacion'] as const;
export type CanalNotificacion = (typeof CANALES_NOTIFICACION)[number];

export const ESTADOS_ENTREGA = [
  'pendiente',
  'enviada',
  'fallida',
  'descartada',
] as const;
export type EstadoEntrega = (typeof ESTADOS_ENTREGA)[number];

export const TIPOS_NOTIFICACION = [
  'calificacion-corregida',
  'acceso-inusual',
  'recuperacion-solicitada',
  'recuperacion-completada',
  'contrasena-cambiada',
  'solicitud-actualizada',
] as const;

export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

export interface Notificacion {
  readonly id: string;
  readonly tipo: TipoNotificacion;
  readonly canal: CanalNotificacion;
  readonly estadoEntrega: EstadoEntrega;
  readonly creadaEl: string;
  readonly leidaEl: string | null;
  readonly titulo: string;
  readonly cuerpo: string;
  // El cuerpo nunca lleva el token de recuperacion, la calificacion anterior
  // ni ningun dato de mas (RNFS-024, RF-091): una notificacion viaja por un
  // canal que no controlamos.
}
