/**
 * @securecampus/contracts
 *
 * Vocabulario y esquemas compartidos entre `apps/web` y `apps/api`.
 *
 * Lo que este paquete comparte son *formas de datos*, nunca decisiones de
 * seguridad. El frontend valida con los mismos esquemas para dar buenos
 * mensajes de error, y el backend vuelve a validar exactamente lo mismo porque
 * todo lo que llega del navegador es editable por el usuario (RNFS-001).
 */

export * from './comunes.js';
export * from './permisos.js';
export * from './decisiones.js';
export * from './autenticacion.js';
export * from './academico.js';
export * from './calificaciones.js';
export * from './documentos.js';
export * from './auditoria.js';
