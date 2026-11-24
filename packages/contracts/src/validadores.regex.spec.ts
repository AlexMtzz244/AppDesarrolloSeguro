import { describe, expect, it } from 'vitest';
import { parsearCalificacionTexto, tieneMaximoDosDecimales } from './validadores.js';

/**
 * SC-LAB-009: la regla `security/detect-unsafe-regex` marco los dos formatos
 * decimales como posible ReDoS. Aqui se mide en lugar de suponer: una entrada
 * hostil de 200 000 caracteres que casi cumple el patron (obliga al motor a
 * probar el final y fallar) debe resolverse en milisegundos.
 */
describe('formatos decimales frente a entradas hostiles', () => {
  const casiValida = `${'9'.repeat(200_000)}.1x`;
  const muchosPuntos = '9.'.repeat(100_000);

  it('parsearCalificacionTexto rechaza la entrada larga sin retroceso exponencial', () => {
    const inicio = Date.now();
    expect(parsearCalificacionTexto(casiValida).ok).toBe(false);
    expect(parsearCalificacionTexto(muchosPuntos).ok).toBe(false);
    expect(Date.now() - inicio).toBeLessThan(250);
  });

  it('tieneMaximoDosDecimales sigue aceptando lo valido', () => {
    expect(tieneMaximoDosDecimales(0.07)).toBe(true);
    expect(tieneMaximoDosDecimales(1e-7)).toBe(false);
  });
});
