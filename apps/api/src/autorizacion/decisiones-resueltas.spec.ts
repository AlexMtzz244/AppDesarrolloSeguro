import { describe, expect, it } from 'vitest';
import {
  CATALOGO_DECISIONES,
  DECISIONES,
  DECISIONES_BLOQUEANTES,
  MATRIZ_ROL_PERMISOS,
  ROLES_BASE,
  ROLES_CON_MFA_OBLIGATORIO,
  detectarConflictosSeparacion,
  type Permiso,
  type RolBase,
} from '@securecampus/contracts';

/**
 * Verifica las propiedades que resuelven D-01, D-06 y D-07.
 *
 * Son pruebas de la **matriz**, no de un endpoint, porque lo que garantiza la
 * separacion de funciones no es codigo que se ejecuta: es una combinacion de
 * permisos que no puede existir. Igual que en `separacion-funciones.spec.ts`,
 * el control vive en la forma del modelo, y esta prueba es lo que impide que
 * alguien lo deshaga sin notarlo.
 */

describe('D-07: quien autoriza un cambio retroactivo no puede ejecutarlo', () => {
  it('ningun rol acumula autorizar y ejecutar', () => {
    for (const rol of ROLES_BASE) {
      const permisos = new Set<string>(MATRIZ_ROL_PERMISOS[rol]);
      const autoriza = permisos.has('periodo:autorizar-retroactivo');
      const ejecuta = permisos.has('periodo:modificar-retroactivo');

      expect(
        autoriza && ejecuta,
        `El rol "${rol}" puede autorizar Y ejecutar un cambio retroactivo. ` +
          'Eso devuelve a una sola cuenta el poder de alterar el pasado, que es ' +
          'justo lo que D-07 se resolvio para evitar.',
      ).toBe(false);
    }
  });

  it('la combinacion se rechaza aunque venga de dos roles distintos', () => {
    // El camino realista: alguien con el rol de autoridad recibe ademas el de
    // administrador "para que pueda ayudar". Por separado ninguno es
    // problematico; juntos concentran el flujo entero.
    const acumulados: Permiso[] = [
      ...MATRIZ_ROL_PERMISOS['autoridad-academica'],
      ...MATRIZ_ROL_PERMISOS.administrador,
    ];

    const conflictos = detectarConflictosSeparacion(acumulados);
    const tienePar = conflictos.some(
      (c) =>
        (c.permisoA === 'periodo:autorizar-retroactivo' &&
          c.permisoB === 'periodo:modificar-retroactivo') ||
        (c.permisoB === 'periodo:autorizar-retroactivo' &&
          c.permisoA === 'periodo:modificar-retroactivo'),
    );

    expect(tienePar, 'La acumulacion autoridad + administrador debe rechazarse.').toBe(true);
  });

  it('quien autoriza tampoco puede tocar calificaciones', () => {
    // El cambio retroactivo mas valioso de conseguir es alterar una nota de un
    // semestre cerrado. Si la autoridad pudiera corregir calificaciones, le
    // bastaria autorizarse el acceso temporal.
    const autoridad = new Set<string>(MATRIZ_ROL_PERMISOS['autoridad-academica']);
    expect(autoridad.has('calificacion:crear')).toBe(false);
    expect(autoridad.has('calificacion:corregir')).toBe(false);
    expect(autoridad.has('calificacion:publicar')).toBe(false);
  });

  it('la autoridad puede leer la auditoria', () => {
    // No es un privilegio de mas: una autoridad que aprueba cambios sin poder
    // revisar el historial aprueba a ciegas.
    expect(MATRIZ_ROL_PERMISOS['autoridad-academica']).toContain('auditoria:consultar');
  });

  it('el rol exige segundo factor', () => {
    expect(ROLES_CON_MFA_OBLIGATORIO).toContain('autoridad-academica' as RolBase);
  });

  it('exactamente un rol puede autorizar y exactamente uno puede ejecutar', () => {
    const autorizan = ROLES_BASE.filter((r) =>
      MATRIZ_ROL_PERMISOS[r].includes('periodo:autorizar-retroactivo'),
    );
    const ejecutan = ROLES_BASE.filter((r) =>
      MATRIZ_ROL_PERMISOS[r].includes('periodo:modificar-retroactivo'),
    );

    // Repartir cualquiera de los dos entre varios roles multiplicaria las
    // cuentas capaces de participar, y con ello la probabilidad de que dos de
    // ellas sean la misma persona.
    expect(autorizan).toEqual(['autoridad-academica']);
    expect(ejecutan).toEqual(['administrador']);
  });
});

describe('registro de decisiones institucionales (SC-SRS-001 §8)', () => {
  it('las once decisiones estan catalogadas', () => {
    expect(DECISIONES).toHaveLength(11);
    for (const id of DECISIONES) {
      expect(CATALOGO_DECISIONES[id], `Falta el catalogo de ${id}`).toBeDefined();
      expect(CATALOGO_DECISIONES[id].id).toBe(id);
    }
  });

  it('cada decision declara quien la aprueba, y no es el equipo', () => {
    for (const id of DECISIONES) {
      const area = CATALOGO_DECISIONES[id].apruebaArea;
      expect(area.length).toBeGreaterThan(3);
      // Si el area que aprueba fuera el equipo de desarrollo, el mecanismo
      // seria una firma que uno se da a si mismo.
      expect(area.toLowerCase()).not.toContain('desarrollo');
      expect(area.toLowerCase()).not.toContain('equipo');
    }
  });

  it('cada decision trae una propuesta concreta que aprobar o rechazar', () => {
    for (const id of DECISIONES) {
      const propuesta = CATALOGO_DECISIONES[id].propuesta;
      // Una "propuesta" vacia o generica devolveria el problema al punto de
      // partida: no habria nada que firmar.
      expect(propuesta.length, `La propuesta de ${id} es demasiado vaga`).toBeGreaterThan(40);
    }
  });

  it('las bloqueantes son pocas, para que el mecanismo no se desactive', () => {
    // Marcarlas todas como bloqueantes volveria el arranque imposible y
    // alguien terminaria quitando la comprobacion entera. Un control que
    // estorba siempre se acaba desactivando.
    expect(DECISIONES_BLOQUEANTES.length).toBeGreaterThan(0);
    expect(DECISIONES_BLOQUEANTES.length).toBeLessThanOrEqual(4);
  });

  it('bloquean produccion las que no admiten un valor por defecto defendible', () => {
    // D-06: un procedimiento de rescate del segundo factor mal disenado es la
    // via preferida para saltarselo.
    // D-07: la designacion de quien ocupa el rol no la puede hacer el equipo.
    // D-10: es la unica para la que ni siquiera hay propuesta posible.
    expect(DECISIONES_BLOQUEANTES).toContain('D-06');
    expect(DECISIONES_BLOQUEANTES).toContain('D-07');
    expect(DECISIONES_BLOQUEANTES).toContain('D-10');
  });
});
