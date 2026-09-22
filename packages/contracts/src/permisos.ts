/**
 * Vocabulario de autorizacion de SecureCampus.
 *
 * Este archivo es la fuente unica de verdad de los permisos, y vive en un
 * paquete compartido por una razon concreta: el frontend necesita conocer los
 * nombres para ocultar opciones de menu, pero **ocultar no es autorizar**
 * (RNFS-001, RNFS-063). Compartir el vocabulario no comparte la decision: la
 * decision se toma siempre en el servidor, contra la sesion.
 *
 * Referencias: SC-SRS-001 §6, SC-LAB-001 escenario 4.
 */

/**
 * Las operaciones son granulares a proposito. Un permiso de lectura nunca
 * habilita escritura (RNFS-004).
 *
 * El caso A de SC-LAB-003 §4 es exactamente lo que esto evita: el requisito
 * decia "consultar calificaciones" sin declarar que consultar y modificar son
 * permisos distintos, y para cuando se aclaro el modelo ya se habia construido
 * sobre la lectura permisiva.
 */
export const OPERACIONES = [
  'leer',
  'crear',
  'modificar',
  'publicar',
  'corregir',
  'administrar',
  'consultar-auditoria',
] as const;

export type Operacion = (typeof OPERACIONES)[number];

/** Los recursos protegidos del dominio. */
export const RECURSOS = [
  'perfil',
  'usuario',
  'rol',
  'programa',
  'periodo',
  'materia',
  'aula',
  'grupo',
  'inscripcion',
  'asignacion-docente',
  'calificacion',
  'documento',
  'solicitud',
  'auditoria',
  'alerta',
] as const;

export type Recurso = (typeof RECURSOS)[number];

/**
 * Catalogo cerrado de permisos, en formato `recurso:operacion`.
 *
 * Es una lista explicita y no un producto cartesiano de recursos por
 * operaciones: la mayoria de esas combinaciones no tiene sentido, y generarlas
 * automaticamente crearia permisos que nadie decidio otorgar. Eso seria lo
 * contrario de *deny by default*.
 */
export const PERMISOS = [
  'perfil:leer',
  'perfil:modificar',

  'usuario:leer',
  'usuario:crear',
  'usuario:modificar',

  'rol:administrar',

  'programa:leer',
  'programa:administrar',

  'periodo:leer',
  'periodo:crear',
  'periodo:modificar',
  'periodo:modificar-retroactivo',
  'periodo:autorizar-retroactivo',

  'materia:leer',
  'materia:administrar',
  'aula:leer',
  'aula:administrar',

  'grupo:leer',
  'grupo:crear',
  'grupo:modificar',

  'inscripcion:leer',
  'inscripcion:crear',

  'asignacion-docente:leer',
  'asignacion-docente:crear',

  'calificacion:leer',
  'calificacion:crear',
  'calificacion:publicar',
  'calificacion:corregir',

  'documento:leer',
  'documento:crear',

  'solicitud:leer',
  'solicitud:crear',
  'solicitud:modificar',

  'auditoria:consultar',
  'alerta:consultar',
] as const;

export type Permiso = (typeof PERMISOS)[number];

export const ES_PERMISO = (valor: string): valor is Permiso =>
  (PERMISOS as readonly string[]).includes(valor);

/** Roles sembrados inicialmente. La matriz definitiva es configurable (D-08). */
export const ROLES_BASE = [
  'estudiante',
  'profesor',
  'jefe-carrera',
  'administrador',
  'autoridad-academica',
] as const;

export type RolBase = (typeof ROLES_BASE)[number];

/**
 * Matriz rol -> permisos del estado inicial sembrado (SC-SRS-001 §6).
 *
 * Tener el permiso NO significa poder tocar cualquier recurso de ese tipo:
 * significa que la politica del endpoint procedera a resolver la relacion
 * concreta (propiedad, adscripcion al programa, asignacion docente vigente)
 * contra la base de datos. El permiso es la condicion necesaria; la relacion
 * es la suficiente.
 */
export const MATRIZ_ROL_PERMISOS: Readonly<Record<RolBase, readonly Permiso[]>> = {
  estudiante: [
    'perfil:leer',
    'perfil:modificar',
    'calificacion:leer',
    'documento:leer',
    'documento:crear',
    'solicitud:leer',
    'solicitud:crear',
  ],
  profesor: [
    'perfil:leer',
    'perfil:modificar',
    'grupo:leer',
    'inscripcion:leer',
    'asignacion-docente:leer',
    'calificacion:leer',
    'calificacion:crear',
    'calificacion:publicar',
    'documento:crear',
    'solicitud:leer',
    'solicitud:crear',
  ],
  'jefe-carrera': [
    'perfil:leer',
    'perfil:modificar',
    'programa:leer',
    'periodo:leer',
    'materia:leer',
    'aula:leer',
    'grupo:leer',
    'grupo:crear',
    'grupo:modificar',
    'inscripcion:leer',
    'inscripcion:crear',
    'asignacion-docente:leer',
    'asignacion-docente:crear',
    'documento:crear',
    'solicitud:leer',
    'solicitud:crear',
  ],
  administrador: [
    'perfil:leer',
    'perfil:modificar',
    'usuario:leer',
    'usuario:crear',
    'usuario:modificar',
    'rol:administrar',
    'programa:leer',
    'programa:administrar',
    'periodo:leer',
    'periodo:crear',
    'periodo:modificar',
    'periodo:modificar-retroactivo',
    'materia:leer',
    'materia:administrar',
    'aula:leer',
    'aula:administrar',
    'grupo:leer',
    'calificacion:corregir',
    'documento:leer',
    'documento:crear',
    'solicitud:leer',
    'solicitud:modificar',
    'auditoria:consultar',
    'alerta:consultar',
  ],
  /**
   * Autoridad academica (resuelve D-07).
   *
   * Existe para una sola cosa: **conceder** autorizaciones extraordinarias
   * sobre periodos cerrados. No puede usarlas.
   *
   * Es la respuesta al problema que D-07 dejaba abierto. Designar a una
   * persona con `periodo:modificar-retroactivo` habria creado una cuenta
   * capaz de alterar el pasado por si sola, que es exactamente el tipo de
   * concentracion de poder que SC-LAB-001 escenario 5 identifica como el
   * riesgo. Partir el permiso en dos —autorizar y ejecutar— hace que **ningun
   * actor individual pueda completar un cambio retroactivo**.
   *
   * Tambien consulta la auditoria, porque una autoridad que aprueba cambios
   * sin poder revisar el historial aprueba a ciegas.
   */
  'autoridad-academica': [
    'perfil:leer',
    'perfil:modificar',
    'programa:leer',
    'periodo:leer',
    'periodo:autorizar-retroactivo',
    'grupo:leer',
    'asignacion-docente:leer',
    'calificacion:leer',
    'documento:crear',
    'solicitud:leer',
    'solicitud:crear',
    'auditoria:consultar',
    'alerta:consultar',
  ],
};

/**
 * Separacion de funciones (RNFS-007).
 *
 * Cada par describe dos permisos que una misma cuenta no puede acumular. Se
 * evalua **al asignar el rol**, no al usarlo: rechazar la combinacion en el
 * momento del uso dejaria que exista una cuenta capaz de encadenar el ataque,
 * y el control estaria dependiendo de que nadie lo intente.
 *
 * El primer par es el que cierra el escenario 5 de SC-LAB-001: el jefe de
 * carrera que se asigna un grupo, entra a calificaciones —donde la
 * verificacion responde correctamente que SI esta autorizado— modifica notas y
 * revierte la asignacion. El ataque no rompe ningun control, los usa. Lo unico
 * que lo impide de forma preventiva es que esos dos permisos no puedan
 * convivir en una cuenta.
 */
export const PARES_INCOMPATIBLES: readonly (readonly [Permiso, Permiso])[] = [
  ['asignacion-docente:crear', 'calificacion:crear'],
  ['asignacion-docente:crear', 'calificacion:publicar'],
  ['asignacion-docente:crear', 'calificacion:corregir'],
  // Quien administra los roles no debe poder otorgarse capacidad academica
  // operativa con la misma cuenta.
  ['rol:administrar', 'calificacion:crear'],
  ['rol:administrar', 'asignacion-docente:crear'],
  // Quien AUTORIZA un cambio retroactivo no puede EJECUTARLO (D-07).
  //
  // Es el par mas importante de esta lista despues del primero. Sin el, la
  // "autorizacion extraordinaria" seria una formalidad que el mismo actor se
  // concede a si mismo, y el flujo excepcional valdria lo mismo que el
  // ordinario. Con el, alterar un periodo cerrado exige forzosamente dos
  // cuentas distintas y dos motivos escritos.
  ['periodo:autorizar-retroactivo', 'periodo:modificar-retroactivo'],
  // Y quien autoriza tampoco debe poder capturar o corregir calificaciones:
  // el cambio retroactivo mas valioso de conseguir es justamente ese.
  ['periodo:autorizar-retroactivo', 'calificacion:corregir'],
  ['periodo:autorizar-retroactivo', 'calificacion:crear'],
];

export interface ConflictoSeparacionFunciones {
  readonly permisoA: Permiso;
  readonly permisoB: Permiso;
}

/**
 * Devuelve los conflictos de separacion de funciones de un conjunto de
 * permisos. Un arreglo vacio significa que la combinacion es admisible.
 */
export function detectarConflictosSeparacion(
  permisos: readonly Permiso[],
): ConflictoSeparacionFunciones[] {
  const presentes = new Set<Permiso>(permisos);
  const conflictos: ConflictoSeparacionFunciones[] = [];

  for (const [permisoA, permisoB] of PARES_INCOMPATIBLES) {
    if (presentes.has(permisoA) && presentes.has(permisoB)) {
      conflictos.push({ permisoA, permisoB });
    }
  }

  return conflictos;
}

/**
 * Roles para los que el segundo factor es obligatorio (RF-003).
 *
 * El estudiante queda fuera no por ser menos importante, sino porque su
 * alcance es solo su propia informacion; los otros tres pueden alcanzar
 * informacion de terceros o alterar el modelo de autorizacion.
 */
export const ROLES_CON_MFA_OBLIGATORIO: readonly RolBase[] = [
  'administrador',
  'autoridad-academica',
  'profesor',
  'jefe-carrera',
];

/**
 * Permisos cuyo uso exige **siempre** motivo escrito, que queda en la bitacora
 * (RNFS-062).
 */
export const PERMISOS_QUE_EXIGEN_MOTIVO: readonly Permiso[] = [
  'calificacion:corregir',
  'periodo:modificar-retroactivo',
  'periodo:autorizar-retroactivo',
  'asignacion-docente:crear',
  'rol:administrar',
];

/**
 * `documento:leer` no esta en la lista anterior a proposito: el titular
 * descargando su propio documento no debe justificar nada. El motivo se exige
 * cuando la relacion no es de propiedad —una descarga administrativa sobre el
 * documento de otro (RF-052)— y eso no lo sabe el permiso, lo sabe la politica
 * al resolver la relacion contra la base. Exigirlo aqui seria confundir el
 * permiso con la relacion, que es justo el error que el proyecto entero evita.
 */
export const EXIGE_MOTIVO_SI_NO_ES_TITULAR: readonly Permiso[] = ['documento:leer'];
