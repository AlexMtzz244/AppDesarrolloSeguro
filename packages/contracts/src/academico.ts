import { z } from 'zod';
import { esquemaId, esquemaMotivo } from './comunes.js';

/**
 * Contratos del dominio academico: programas, periodos, grupos y asignacion
 * docente. Requisitos RF-020 a RF-033.
 */

export const ESTADOS_PERIODO = ['abierto', 'cerrado'] as const;
export type EstadoPeriodo = (typeof ESTADOS_PERIODO)[number];

export const DIAS_SEMANA = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

/** Hora local en formato HH:MM de 24 horas. */
const esquemaHora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora invalida, se espera HH:MM');

export const esquemaBloqueHorario = z
  .object({
    dia: z.enum(DIAS_SEMANA),
    horaInicio: esquemaHora,
    horaFin: esquemaHora,
  })
  .refine((b) => b.horaInicio < b.horaFin, {
    message: 'La hora de inicio debe ser anterior a la de fin',
    path: ['horaFin'],
  });

export type BloqueHorario = z.infer<typeof esquemaBloqueHorario>;

export const esquemaCrearGrupo = z.object({
  clave: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{3,20}$/, 'La clave del grupo usa mayusculas, digitos y guiones'),
  materiaId: esquemaId,
  periodoId: esquemaId,
  aulaId: esquemaId,
  cupo: z.number().int().min(1).max(200),
  horario: z.array(esquemaBloqueHorario).min(1),
  // El programa NO viaja en el cuerpo: se deriva de la adscripcion del jefe de
  // carrera en el servidor (RNFS-003). Aceptarlo aqui permitiria crear grupos
  // en otro programa con solo cambiar un campo del formulario, que es la
  // vulnerabilidad (c) del escenario 5 de SC-LAB-001.
});

export type CrearGrupo = z.infer<typeof esquemaCrearGrupo>;

/**
 * Asignacion docente (RF-030, RF-031).
 *
 * No existe un esquema de "modificar asignacion" y eso es intencional: la
 * asignacion es un historial versionado, no un campo sobrescribible. Cambiar
 * de profesor se modela cerrando la vigencia actual y abriendo una nueva, de
 * modo que el paso intermedio quede en el registro.
 *
 * Es el control prioritario del escenario 5 de SC-LAB-001: contra un jefe que
 * actua dentro de sus atribuciones formales la prevencion tiene poco margen,
 * y lo que queda es que el cambio sea visible, atribuible e irreversible.
 */
export const esquemaCrearAsignacionDocente = z.object({
  grupoId: esquemaId,
  profesorId: esquemaId,
  desde: z.coerce.date(),
  hasta: z.coerce.date().nullable().default(null),
  motivo: esquemaMotivo,
});

export type CrearAsignacionDocente = z.infer<typeof esquemaCrearAsignacionDocente>;

export const esquemaCerrarAsignacionDocente = z.object({
  asignacionId: esquemaId,
  hasta: z.coerce.date(),
  motivo: esquemaMotivo,
});

/**
 * Cambio sobre un periodo cerrado (RF-033).
 *
 * El flujo ordinario debe rechazarlo. Este esquema pertenece a un endpoint
 * distinto, que exige el permiso `periodo:modificar-retroactivo` y la
 * referencia a una autorizacion previa. Separar los endpoints —en vez de
 * agregar una bandera `retroactivo: true` al flujo normal— es lo que impide
 * que el camino excepcional se tome por descuido.
 */
export const esquemaCambioRetroactivo = z.object({
  periodoId: esquemaId,
  autorizacionId: esquemaId,
  motivo: esquemaMotivo,
});

export const esquemaCrearPeriodo = z
  .object({
    clave: z.string().trim().min(3).max(20),
    inicia: z.coerce.date(),
    termina: z.coerce.date(),
  })
  .refine((p) => p.inicia < p.termina, {
    message: 'La fecha de inicio debe ser anterior a la de termino',
    path: ['termina'],
  });

/** Motivos por los que se rechaza un alta o cambio de grupo/asignacion. */
export const CONFLICTOS_PROGRAMACION = [
  'choque-horario-profesor',
  'choque-horario-aula',
  'choque-horario-grupo',
  'carga-docente-excedida',
  'periodo-cerrado',
  'programa-ajeno',
  'cupo-invalido',
] as const;

export type ConflictoProgramacion = (typeof CONFLICTOS_PROGRAMACION)[number];
