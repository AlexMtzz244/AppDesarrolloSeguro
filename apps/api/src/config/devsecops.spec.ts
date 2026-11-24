import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * SC-LAB-009: controles DevSecOps como configuracion verificable.
 *
 * Cada prueba fija un fallo REAL que el laboratorio destapo al construir las
 * imagenes por primera vez (ninguna se habia construido antes). Son pruebas de
 * configuracion: no ejecutan Docker, pero impiden que el fallo vuelva a entrar.
 */

const leer = (ruta: string) => readFileSync(resolve(__dirname, '../../../..', ruta), 'utf8');

/** Instrucciones de una etapa del Dockerfile, sin comentarios. */
function etapa(ruta: string, nombre: string): string[] {
  const bloque = leer(ruta)
    .split(/^FROM /m)
    .slice(1)
    .find((b) => b.split('\n')[0]!.endsWith(`AS ${nombre}`));
  if (!bloque) throw new Error(`${ruta}: no existe la etapa ${nombre}`);
  return bloque
    .split('\n')
    .slice(1)
    .filter((l) => l.trim() && !l.trim().startsWith('#'));
}

describe.each(['apps/api/Dockerfile', 'apps/web/Dockerfile'])('%s', (ruta) => {
  it.each(['desarrollo', 'construccion'])(
    'la etapa %s copia contracts completo antes de `pnpm install` (su postinstall corre tsc)',
    (nombre) => {
      const lineas = etapa(ruta, nombre);
      const instalar = lineas.findIndex((l) => l.startsWith('RUN pnpm install'));
      const copias = lineas.slice(0, instalar).join('\n');
      expect(instalar).toBeGreaterThan(-1);
      expect(copias).toContain('COPY tsconfig.base.json');
      expect(copias).toMatch(/COPY packages\/contracts \.\/packages\/contracts\//);
    },
  );

  it('la imagen de produccion no trae npm ni npx', () => {
    expect(etapa(ruta, 'produccion').join('\n')).toMatch(/rm -rf .*node_modules\/npm.*\/bin\/npm.*\/bin\/npx/);
  });
});

describe('apps/api/Dockerfile', () => {
  it('el esquema de Prisma llega antes de `pnpm install` (postinstall: prisma generate)', () => {
    for (const nombre of ['desarrollo', 'construccion']) {
      const lineas = etapa('apps/api/Dockerfile', nombre);
      const instalar = lineas.findIndex((l) => l.startsWith('RUN pnpm install'));
      expect(lineas.slice(0, instalar).join('\n')).toContain('COPY apps/api/prisma');
    }
  });

  it('no usa `pnpm prune` (en este monorepo deja node_modules vacio)', () => {
    expect(etapa('apps/api/Dockerfile', 'construccion').join('\n')).not.toMatch(/pnpm prune/);
  });

  it('la poda a produccion se limita a la API y no pide confirmacion ni ejecuta husky', () => {
    const run = etapa('apps/api/Dockerfile', 'construccion').join('\n');
    expect(run).toContain('CI=true pnpm install --frozen-lockfile --prod --ignore-scripts --filter "api..."');
  });

  it('la imagen final lleva el paquete contracts completo (package.json, node_modules y dist)', () => {
    const final = etapa('apps/api/Dockerfile', 'produccion').join('\n');
    for (const parte of ['packages/contracts/package.json', 'packages/contracts/node_modules', 'packages/contracts/dist']) {
      expect(final).toContain(`/app/${parte}`);
    }
  });
});

describe('apps/web/Dockerfile', () => {
  it('la imagen final lleva el node_modules de la web y arranca Next con `node`', () => {
    const final = etapa('apps/web/Dockerfile', 'produccion').join('\n');
    expect(final).toContain('/app/apps/web/node_modules');
    expect(final).toContain('CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web"]');
    expect(final).not.toContain('.bin/next');
  });
});

describe('.github/workflows/sc-lab-009-devsecops.yml', () => {
  interface Paso {
    name?: string;
    run?: string;
    uses?: string;
  }
  interface Trabajo {
    steps: Paso[];
    env?: Record<string, string>;
  }
  const flujo = parse(leer('.github/workflows/sc-lab-009-devsecops.yml')) as {
    permissions: Record<string, string>;
    jobs: Record<string, Trabajo>;
  };
  const pasosDe = (trabajo: string) => flujo.jobs[trabajo]!.steps;

  it('tiene los dos trabajos del laboratorio', () => {
    expect(Object.keys(flujo.jobs).sort()).toEqual(['contenedor', 'sast']);
  });

  it('permisos minimos: solo lectura del contenido', () => {
    expect(flujo.permissions).toEqual({ contents: 'read' });
  });

  it('todas las acciones de terceros van fijadas por SHA', () => {
    const acciones = Object.values(flujo.jobs).flatMap((t) => t.steps.map((p) => p.uses).filter(Boolean)) as string[];
    expect(acciones.length).toBeGreaterThan(0);
    expect(acciones.filter((a) => !/@[0-9a-f]{40}$/.test(a))).toEqual([]);
  });

  it('el trabajo sast ejecuta `pnpm sast`', () => {
    expect(pasosDe('sast').some((p) => p.run === 'pnpm sast')).toBe(true);
  });

  it('Trivy va fijado por digest, no por etiqueta', () => {
    expect(flujo.jobs['contenedor']!.env!['TRIVY_IMAGEN']).toMatch(/^aquasec\/trivy@sha256:[0-9a-f]{64}$/);
  });

  it('la compuerta de Trivy bloquea en alta y critica con correccion', () => {
    const compuerta = pasosDe('contenedor').find((p) => p.name?.includes('compuerta'))!;
    expect(compuerta.run).toContain('--severity HIGH,CRITICAL');
    expect(compuerta.run).toContain('--ignore-unfixed');
    expect(compuerta.run).toContain('--exit-code 1');
  });

  it('el informe completo no bloquea y la compuerta usa bash (para conservar el codigo de Trivy)', () => {
    const informe = pasosDe('contenedor').find((p) => p.name?.includes('informe completo'))!;
    expect(informe.run).toContain('--exit-code 0');
    const compuerta = pasosDe('contenedor').find((p) => p.name?.includes('compuerta')) as Paso & { shell?: string };
    expect(compuerta.shell).toBe('bash');
  });
});
