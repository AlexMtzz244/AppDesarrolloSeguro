import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AccesoDenegado } from '../comun/excepciones.filter.js';
import type { Entorno } from '../config/entorno.js';
import { OrigenGuard, evaluarOrigen } from './origen.guard.js';

const PERMITIDOS = ['http://localhost:3000', 'https://campus.example.mx'];
const decidir = (
  metodo: string,
  origin?: string,
  secFetchSite?: string,
  permitidos: readonly string[] = PERMITIDOS,
) => evaluarOrigen({ metodo, origin, secFetchSite }, permitidos);

describe('evaluarOrigen (CSRF por origen, SC-LAB-007)', () => {
  it.each(['GET', 'HEAD', 'OPTIONS', 'get'])('%s nunca se bloquea: no cambia estado', (metodo) => {
    expect(decidir(metodo, 'https://sitio-malicioso.example', 'cross-site').permitido).toBe(true);
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('%s desde un origen ajeno se rechaza', (metodo) => {
    const d = decidir(metodo, 'https://sitio-malicioso.example');
    expect(d.permitido).toBe(false);
  });

  it.each(PERMITIDOS)('POST desde el origen permitido %s procede', (origen) => {
    expect(decidir('POST', origen).permitido).toBe(true);
  });

  it('tolera la barra final en el origen o en la lista', () => {
    expect(decidir('POST', 'http://localhost:3000/').permitido).toBe(true);
    expect(decidir('POST', 'http://localhost:3000', undefined, ['http://localhost:3000/']).permitido).toBe(true);
  });

  it('no confunde un origen que solo EMPIEZA igual que uno permitido', () => {
    expect(decidir('POST', 'http://localhost:3000.atacante.example').permitido).toBe(false);
    expect(decidir('POST', 'http://localhost:30001').permitido).toBe(false);
  });

  it('rechaza `Origin: null` (iframe con sandbox, redireccion entre sitios)', () => {
    expect(decidir('POST', 'null').permitido).toBe(false);
  });

  it('sin Origin, Sec-Fetch-Site cross-site se rechaza', () => {
    expect(decidir('DELETE', undefined, 'cross-site').permitido).toBe(false);
  });

  it.each(['same-origin', 'same-site', 'none'])(
    'sin Origin, Sec-Fetch-Site %s procede',
    (valor) => {
      expect(decidir('POST', undefined, valor).permitido).toBe(true);
    },
  );

  it('un cliente sin ninguna de las dos cabeceras (curl, servicio) procede', () => {
    expect(decidir('POST').permitido).toBe(true);
  });

  it('Origin pesa mas que Sec-Fetch-Site: un origen ajeno se rechaza aunque diga same-site', () => {
    expect(decidir('POST', 'https://otro.example', 'same-site').permitido).toBe(false);
  });
});

describe('OrigenGuard', () => {
  const entorno = { CORS_ORIGENES_PERMITIDOS: PERMITIDOS } as Entorno;
  const contexto = (metodo: string, cabeceras: Record<string, string>): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: metodo,
          path: '/api/calificaciones/captura',
          header: (n: string) => cabeceras[n.toLowerCase()],
        }),
      }),
    }) as unknown as ExecutionContext;

  it('lanza 403 ante un POST de otro origen', () => {
    const guard = new OrigenGuard(entorno);
    expect(() => guard.canActivate(contexto('POST', { origin: 'https://atacante.example' }))).toThrow(
      AccesoDenegado,
    );
  });

  it('deja pasar el POST del origen del frontend', () => {
    const guard = new OrigenGuard(entorno);
    expect(guard.canActivate(contexto('POST', { origin: 'http://localhost:3000' }))).toBe(true);
  });
});
