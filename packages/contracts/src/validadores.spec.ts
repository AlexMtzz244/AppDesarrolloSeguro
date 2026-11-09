import { describe, expect, it } from 'vitest';
import {
  esquemaCapturaLote,
  esquemaValorCalificacion,
} from './calificaciones.js';
import { parsearCalificacionTexto, tieneMaximoDosDecimales } from './validadores.js';

/**
 * Equivalente de `test_grade_invalid` de SC-LAB-006: los mismos casos del
 * laboratorio, mas los que el laboratorio no cubria y que el diagnostico de la
 * app encontro (`1e-7`, `5e-324`, `0x10`, `1e1`).
 */

const INVALIDOS_NUMERO: unknown[] = [
  150, -1, 100.01, 'hola', '', '98.5', 'NaN', 'Infinity', NaN, Infinity, -Infinity,
  null, undefined, true, false, 99.999, 1e-7, 5e-324, 1.005,
];

const VALIDOS_NUMERO = [0, 100, 98.5, 0.07, 1.1, 99.99, 50, 0.01];

describe('esquemaValorCalificacion', () => {
  it.each(INVALIDOS_NUMERO.map((v) => [String(v), v]))('rechaza %s', (_n, valor) => {
    expect(esquemaValorCalificacion.safeParse(valor).success).toBe(false);
  });

  it.each(VALIDOS_NUMERO)('acepta %s', (valor) => {
    expect(esquemaValorCalificacion.safeParse(valor).success).toBe(true);
  });

  it('no redondea: 99.999 se rechaza en vez de volverse 100', () => {
    expect(esquemaValorCalificacion.safeParse(99.999).success).toBe(false);
  });
});

describe('esquemaCapturaLote', () => {
  const ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

  it('rechaza el lote completo si una sola nota es invalida', () => {
    const lote = {
      grupoId: ID,
      calificaciones: [
        { estudianteId: ID, valor: 90 },
        { estudianteId: ID, valor: 1e-7 },
      ],
    };
    expect(esquemaCapturaLote.safeParse(lote).success).toBe(false);
  });

  it('acepta un lote valido', () => {
    const lote = { grupoId: ID, calificaciones: [{ estudianteId: ID, valor: 0.07 }] };
    expect(esquemaCapturaLote.safeParse(lote).success).toBe(true);
  });
});

describe('tieneMaximoDosDecimales', () => {
  it.each([0, 1, 0.1, 0.07, 98.5, 99.99])('acepta %s', (n) => {
    expect(tieneMaximoDosDecimales(n)).toBe(true);
  });
  it.each([1e-7, 5e-324, 99.999, 1.005, NaN, Infinity])('rechaza %s', (n) => {
    expect(tieneMaximoDosDecimales(n)).toBe(false);
  });
});

describe('parsearCalificacionTexto', () => {
  it.each([
    ['0', 0], ['100', 100], ['98.5', 98.5], ['0.07', 0.07], ['1.1', 1.1],
    ['99.99', 99.99], ['  75 ', 75],
  ])('acepta "%s"', (texto, esperado) => {
    expect(parsearCalificacionTexto(texto)).toEqual({ ok: true, valor: esperado });
  });

  it.each([
    '150', '-1', 'hola', '', '   ', 'NaN', 'Infinity', '99.999', '0x10', '1e1',
    '1e-7', '+5', '1,5', '10.', '.5', '1000',
  ])('rechaza "%s"', (texto) => {
    expect(parsearCalificacionTexto(texto).ok).toBe(false);
  });

  it('da mensajes distintos segun la causa', () => {
    const msg = (t: string) => {
      const r = parsearCalificacionTexto(t);
      return r.ok ? '' : r.mensaje;
    };
    const mensajes = new Set([msg(''), msg('-1'), msg('99.999'), msg('hola'), msg('150')]);
    expect(mensajes.size).toBe(5);
  });
});
