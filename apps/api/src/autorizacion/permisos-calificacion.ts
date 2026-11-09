import type { DecisionRelacion } from './politica.decorator.js';
import { denegar, permitir } from './politica.decorator.js';

/**
 * Decisiones de permiso sobre calificaciones, como funciones puras
 * (patron de SC-LAB-006, `permissions.py`).
 *
 * No tocan la base de datos: reciben hechos ya resueltos y devuelven la
 * decision. Los resolvedores de `relaciones.ts` hacen la consulta y delegan
 * aqui, de modo que cada regla se prueba con una tabla de verdad sin levantar
 * Postgres. Todas deniegan por omision: solo permite la combinacion completa.
 */

export interface Vigencia {
  readonly desdeEl: Date;
  readonly hastaEl: Date | null;
}

/** `desdeEl <= ahora` y `hastaEl` nulo o posterior a `ahora` (limite abierto). */
export function asignacionEsVigente(vigencia: Vigencia, ahora: Date): boolean {
  if (vigencia.desdeEl.getTime() > ahora.getTime()) return false;
  return vigencia.hastaEl === null || vigencia.hastaEl.getTime() > ahora.getTime();
}

export interface HechosModificacion {
  readonly tieneAsignacionVigente: boolean;
  readonly periodoAbierto: boolean;
  /** `undefined` cuando no se evalua la inscripcion (p. ej. lista de captura). */
  readonly estudianteInscrito?: boolean;
}

/**
 * Escribir: asignacion vigente, periodo abierto y, si se indica, estudiante
 * inscrito. El orden importa: primero la relacion y despues el periodo, para
 * que un profesor ajeno no distinga "no es tuyo" de "esta cerrado".
 */
export function puedeModificarCalificacion(h: HechosModificacion): DecisionRelacion {
  if (!h.tieneAsignacionVigente) return denegar('sin-asignacion-vigente');
  if (!h.periodoAbierto) return denegar('periodo-cerrado');
  if (h.estudianteInscrito === false) return denegar('estudiante-no-inscrito');
  return permitir();
}

export interface HechosConsulta {
  readonly esTitular: boolean;
  readonly estado: string;
  readonly profesorConAsignacionVigente: boolean;
}

/**
 * Leer: el titular (salvo borrador) o el profesor con asignacion vigente.
 * No exige periodo abierto: consultar un semestre cerrado es legitimo.
 */
export function puedeConsultarCalificacion(h: HechosConsulta): DecisionRelacion {
  if (h.esTitular) {
    return h.estado === 'borrador' ? denegar('calificacion-en-borrador') : permitir();
  }
  return h.profesorConAsignacionVigente ? permitir() : denegar('calificacion-ajena');
}

/** Corregir: solo lo ya publicado; un borrador se edita por el flujo ordinario. */
export function puedeCorregirCalificacion(h: { readonly estado: string }): DecisionRelacion {
  return h.estado === 'borrador' ? denegar('calificacion-en-borrador') : permitir();
}
