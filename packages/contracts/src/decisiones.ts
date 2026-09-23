/**
 * Registro de decisiones institucionales pendientes (SC-SRS-001 §8).
 *
 * # Por que este archivo existe
 *
 * SC-SRS-001 §8 establece la regla: *"codificar un valor inventado no lo
 * convierte en decidido, lo convierte en invisible, que es peor"*.
 *
 * La lectura fácil de esa regla es "no pongas ningún valor". Es una lectura
 * incompleta, y dejaba tres funciones bloqueadas sin que nadie pudiera
 * siquiera probarlas.
 *
 * La lectura correcta es que **el problema nunca fue que alguien decidiera:
 * fue que la decisión quedara invisible**. Es exactamente el argumento de la
 * bitácora append-only — contra un actor que opera dentro de sus atribuciones
 * la prevención tiene poco margen, y lo que queda es que el acto sea visible,
 * atribuible e irreversible en el registro (SC-LAB-001 escenario 5).
 *
 * Así que aquí se aplica el mismo patrón a la configuración:
 *
 *   - El sistema **propone** un valor por defecto seguro y funciona con él.
 *   - La propuesta es **visible**: la interfaz la muestra como no aprobada.
 *   - Es **atribuible**: al aprobarse se registra quién y cuándo.
 *   - Y es **exigible**: el arranque en producción se niega mientras una
 *     decisión marcada como bloqueante siga sin aprobar.
 *
 * Ese último punto es lo que impide que una propuesta se convierta en el valor
 * inventado que §8 prohíbe. Un valor que bloquea el despliegue no es
 * invisible: es imposible de ignorar.
 */

export const DECISIONES = [
  'D-01',
  'D-02',
  'D-03',
  'D-04',
  'D-05',
  'D-06',
  'D-07',
  'D-08',
  'D-09',
  'D-10',
  'D-11',
] as const;

export type IdDecision = (typeof DECISIONES)[number];

export interface Decision {
  readonly id: IdDecision;
  readonly titulo: string;
  /** Quién tiene la autoridad para aprobarla. No es el equipo de desarrollo. */
  readonly apruebaArea: string;
  /**
   * Si es `true`, el arranque en producción falla mientras no esté aprobada.
   *
   * Se reserva para las decisiones cuyo valor por defecto sería peligroso o
   * carecería de sustento en un entorno real. Marcarlas todas como bloqueantes
   * volvería el mecanismo inservible y alguien terminaría desactivándolo.
   */
  readonly bloqueaProduccion: boolean;
  /** Qué propone el equipo, para que haya algo concreto que aprobar o rechazar. */
  readonly propuesta: string;
}

export const CATALOGO_DECISIONES: Readonly<Record<IdDecision, Decision>> = {
  'D-01': {
    id: 'D-01',
    titulo: 'Catálogo de solicitudes, estados, responsables y SLA',
    apruebaArea: 'Servicios escolares',
    bloqueaProduccion: true,
    propuesta:
      'Tres tipos genéricos con flujo común (recibida → en revisión → resuelta/rechazada) ' +
      'y SLA de 120 horas hábiles. Ninguno inventa una regla académica: son trámites que ' +
      'existen en cualquier institución.',
  },
  'D-02': {
    id: 'D-02',
    titulo: 'Campos editables del perfil y proceso de corrección',
    apruebaArea: 'Servicios escolares',
    bloqueaProduccion: false,
    propuesta:
      'Solo teléfono editable por el titular. La corrección de nombre o matrícula entra ' +
      'por el tipo de solicitud "corrección de datos", que deja rastro y responsable.',
  },
  'D-03': {
    id: 'D-03',
    titulo: 'Escala de calificaciones y reglas de publicación/corrección',
    apruebaArea: 'Dirección académica',
    bloqueaProduccion: false,
    propuesta:
      'Escala 0–100 con dos decimales. No se codifica regla de aprobación, redondeo ni ' +
      'ponderación: el sistema guarda lo que el profesor captura y no opina.',
  },
  'D-04': {
    id: 'D-04',
    titulo: 'Catálogo de documentos, formatos, tamaño máximo y cuota',
    apruebaArea: 'Servicios escolares',
    bloqueaProduccion: false,
    propuesta: 'PDF/JPG/PNG · 10 MB por archivo · 100 MB por usuario.',
  },
  'D-05': {
    id: 'D-05',
    titulo: 'Umbrales de rate limit, bloqueo, CAPTCHA, inactividad y anomalías',
    apruebaArea: 'Seguridad informática',
    bloqueaProduccion: false,
    propuesta:
      '5 intentos/15 min por cuenta, 20/15 min por origen, inactividad 30 min. ' +
      'Requieren calibración contra tráfico real antes de fijarse.',
  },
  'D-06': {
    id: 'D-06',
    titulo: 'Proveedor de MFA y recuperación del segundo factor',
    apruebaArea: 'Seguridad informática',
    bloqueaProduccion: true,
    propuesta:
      'TOTP propio + 10 códigos de un solo uso. Si se pierden ambos, el restablecimiento ' +
      'exige solicitud presencial y DOS aprobaciones administrativas distintas; el ' +
      'restablecimiento NO da acceso, solo obliga a re-enrolar.',
  },
  'D-07': {
    id: 'D-07',
    titulo: 'Autoridad superior para cambios retroactivos',
    apruebaArea: 'Dirección académica',
    bloqueaProduccion: true,
    propuesta:
      'Rol "autoridad-academica" que solo puede CONCEDER la autorización, nunca usarla. ' +
      'Alterar un periodo cerrado exige forzosamente dos cuentas distintas y dos motivos ' +
      'escritos, y emite alerta crítica inmediata.',
  },
  'D-08': {
    id: 'D-08',
    titulo: 'Matriz final rol–permiso–operación y frecuencia de revisión',
    apruebaArea: 'Dirección académica + Seguridad informática',
    bloqueaProduccion: false,
    propuesta: 'La matriz de SC-SRS-001 §6, con revisión semestral (182 días).',
  },
  'D-09': {
    id: 'D-09',
    titulo: 'Retención y eliminación de datos, y requisitos legales',
    apruebaArea: 'Jurídico',
    bloqueaProduccion: false,
    propuesta: 'Auditoría 200 días mínimo. Sin borrado automático de ningún dato.',
  },
  'D-10': {
    id: 'D-10',
    titulo: 'Volumen, concurrencia, disponibilidad, RTO, RPO, presupuesto y plataforma',
    apruebaArea: 'Dirección de TI',
    bloqueaProduccion: true,
    propuesta:
      'Sin cifras no se puede dimensionar ni comprometer recuperación. No hay propuesta ' +
      'técnica posible: es la única de las once que el equipo no puede ni siquiera esbozar.',
  },
  'D-11': {
    id: 'D-11',
    titulo: 'Procedimiento de incidentes, navegadores soportados e identidad visual',
    apruebaArea: 'Dirección de TI',
    bloqueaProduccion: false,
    propuesta:
      'Procedimiento base en proyDesSeguro/docs/OPERACION.md, pendiente de aprobar y de ensayar. ' +
      'Últimas dos versiones de navegadores con motor Chromium, Firefox y WebKit.',
  },
};

/** Las que impiden arrancar en producción mientras no tengan firma. */
export const DECISIONES_BLOQUEANTES: readonly IdDecision[] = DECISIONES.filter(
  (id) => CATALOGO_DECISIONES[id].bloqueaProduccion,
);

export interface EstadoDecision {
  readonly id: IdDecision;
  readonly aprobada: boolean;
  readonly aprobadoPor: string | null;
  readonly aprobadoEl: string | null;
}
