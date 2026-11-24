import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { agruparPorCampo } from './zod-validacion.pipe.js';

/**
 * SC-LAB-009, hallazgo de SAST `security/detect-object-injection` en
 * `agruparPorCampo`. Hoy ningun esquema de entrada usa claves del cliente en la
 * ruta del error, asi que es latente; la prueba fija el comportamiento para el
 * dia que alguien agregue un `z.record`.
 */
describe('agruparPorCampo', () => {
  const resultado = z.record(z.string(), z.number()).safeParse(
    JSON.parse('{"constructor":"x","__proto__":"y","normal":"z"}'),
  );

  it('agrupa por clave aunque coincida con una propiedad de Object.prototype', () => {
    if (resultado.success) throw new Error('el esquema debia rechazar la entrada');

    const campos = agruparPorCampo(resultado.error);

    expect(Object.keys(campos).sort()).toEqual(['__proto__', 'constructor', 'normal']);
    expect(campos.normal).toHaveLength(1);
  });

  it('devuelve un objeto sin prototipo', () => {
    if (resultado.success) throw new Error('el esquema debia rechazar la entrada');

    expect(Object.getPrototypeOf(agruparPorCampo(resultado.error))).toBeNull();
  });
});
