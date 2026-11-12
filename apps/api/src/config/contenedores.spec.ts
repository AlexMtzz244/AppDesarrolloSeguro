import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * Controles de contenedor (SC-LAB-008, Pasos 7, 8 y 12).
 *
 * El laboratorio pide "marcar cada configuracion al encontrarla": USER no
 * administrador, `read_only`, `cap_drop: ALL`, `no-new-privileges`, tmpfs,
 * volumen y puerto en 127.0.0.1. Esta prueba hace esa lista ejecutable: si
 * alguien afloja uno de los controles, la build lo dice.
 *
 * Es una prueba de CONFIGURACION. No arranca ningun contenedor.
 */

const leer = (ruta: string) => readFileSync(resolve(__dirname, '../../../..', ruta), 'utf8');

interface Servicio {
  profiles?: string[];
  user?: string;
  read_only?: boolean;
  cap_drop?: string[];
  security_opt?: string[];
  tmpfs?: string[];
  volumes?: unknown[];
  ports?: string[];
  build?: { target?: string };
  environment?: Record<string, string>;
}

const compose = parse(leer('docker-compose.yml')) as { services: Record<string, Servicio> };
const ENDURECIDOS = ['api-endurecido', 'web-endurecido'] as const;

describe('docker-compose.yml: perfil endurecido', () => {
  it.each(ENDURECIDOS)('%s existe solo bajo el perfil `endurecido`', (nombre) => {
    expect(compose.services[nombre]?.profiles).toEqual(['endurecido']);
  });

  it.each(ENDURECIDOS)('%s usa la imagen de produccion', (nombre) => {
    expect(compose.services[nombre]?.build?.target).toBe('produccion');
  });

  it.each(ENDURECIDOS)('%s corre sin privilegios: usuario no root, sin capacidades', (nombre) => {
    const s = compose.services[nombre]!;
    expect(s.user).toBe('node');
    expect(s.cap_drop).toContain('ALL');
    expect(s.security_opt).toContain('no-new-privileges:true');
  });

  it.each(ENDURECIDOS)('%s tiene la raiz de solo lectura y /tmp en memoria', (nombre) => {
    const s = compose.services[nombre]!;
    expect(s.read_only).toBe(true);
    expect(s.tmpfs).toContain('/tmp');
  });

  it.each(ENDURECIDOS)('%s no monta el codigo del host', (nombre) => {
    expect(compose.services[nombre]?.volumes).toBeUndefined();
  });

  it('el perfil no impone HTTP: la cookie Secure y los datos semilla estan fijados', () => {
    const env = compose.services['api-endurecido']!.environment!;
    expect(env['SESION_COOKIE_SECURE']).toBe('true');
    expect(env['PERMITIR_DATOS_SEMILLA']).toBe('false');
    expect(env['NODE_ENV']).toBe('production');
  });
});

describe('docker-compose.yml: todos los servicios', () => {
  it('ningun puerto se publica fuera de 127.0.0.1', () => {
    const expuestos = Object.entries(compose.services).flatMap(([nombre, s]) =>
      (s.ports ?? []).map((p) => ({ nombre, p: String(p) })),
    );
    expect(expuestos.length).toBeGreaterThan(0);
    expect(expuestos.filter(({ p }) => !p.startsWith('127.0.0.1:'))).toEqual([]);
  });

  it('ninguna credencial aparece literal: todas se interpolan desde .env', () => {
    const sospechosas = Object.entries(compose.services).flatMap(([nombre, s]) =>
      Object.entries(s.environment ?? {})
        .filter(([clave]) => /PASSWORD|SECRET|SECRETO|_KEY\b/i.test(clave))
        .filter(([, valor]) => !String(valor).startsWith('${'))
        .map(([clave]) => `${nombre}.${clave}`),
    );
    expect(sospechosas).toEqual([]);
  });
});

describe('Dockerfile: la etapa final no es root', () => {
  /** Ultima instruccion USER de la ultima etapa (la que se despliega). */
  const usuarioFinal = (ruta: string): string | undefined => {
    const etapas = leer(ruta).split(/^FROM /m).slice(1);
    const final = etapas[etapas.length - 1]!;
    expect(final.split('\n')[0]).toContain('AS produccion');
    return [...final.matchAll(/^USER\s+(\S+)/gm)].pop()?.[1];
  };

  it.each(['apps/api/Dockerfile', 'apps/web/Dockerfile'])('%s termina con USER node', (ruta) => {
    expect(usuarioFinal(ruta)).toBe('node');
  });
});

describe('.dockerignore: lo que no debe viajar en la imagen', () => {
  const lineas = leer('.dockerignore')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  it.each(['.env', '.git', 'node_modules', '*.db'])('excluye %s', (patron) => {
    expect(lineas).toContain(patron);
  });

  it('conserva la plantilla .env.example', () => {
    expect(lineas).toContain('!.env.example');
  });
});
