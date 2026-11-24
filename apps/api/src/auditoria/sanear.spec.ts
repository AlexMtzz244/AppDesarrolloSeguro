import { describe, expect, it } from 'vitest';
import { sanear } from './auditoria.service.js';

/**
 * SC-LAB-009, hallazgo de SAST `security/detect-object-injection`.
 *
 * De las 18 alertas de esa regla, esta es la unica con una consecuencia real:
 * `sanear` copiaba las claves del objeto a un `{}` normal. Con la clave
 * `__proto__` la asignacion no crea una propiedad, cambia el prototipo de la
 * copia, y esa clave desaparece al serializar el registro de bitacora.
 */
describe('sanear (bitacora)', () => {
  it('conserva la clave __proto__ como dato en lugar de perderla', () => {
    // JSON.parse crea `__proto__` como propiedad propia, igual que un cuerpo HTTP.
    const entrada = JSON.parse('{"campo":"visible","__proto__":{"rol":"ADMIN"}}') as unknown;

    const salida = JSON.parse(JSON.stringify(sanear(entrada))) as Record<string, unknown>;

    expect(Object.keys(salida)).toContain('__proto__');
    expect(salida.campo).toBe('visible');
  });

  it('no deja que la clave __proto__ cambie el prototipo del resultado', () => {
    const entrada = JSON.parse('{"__proto__":{"inyectada":true}}') as unknown;

    const salida = sanear(entrada) as Record<string, unknown>;

    expect(Object.getPrototypeOf(salida)).toBeNull();
    expect(salida.inyectada).toBeUndefined();
  });

  it('sigue omitiendo los campos con forma de credencial, tambien anidados', () => {
    const salida = JSON.parse(
      JSON.stringify(sanear({ usuario: 'a', contrasena: 'x', detalle: { Token_Acceso: 'y', ok: 1 } })),
    ) as Record<string, unknown>;

    expect(salida).toEqual({ usuario: 'a', contrasena: '[omitido]', detalle: { Token_Acceso: '[omitido]', ok: 1 } });
  });
});
