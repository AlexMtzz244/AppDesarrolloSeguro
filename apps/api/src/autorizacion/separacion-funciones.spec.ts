import { describe, expect, it } from 'vitest';
import {
  MATRIZ_ROL_PERMISOS,
  PERMISOS,
  ROLES_BASE,
  detectarConflictosSeparacion,
  type Permiso,
  type RolBase,
} from '@securecampus/contracts';

/**
 * Separacion de funciones y coherencia de la matriz de permisos (RNFS-007).
 *
 * Estas pruebas no ejercitan codigo de servidor: verifican que la **matriz
 * sembrada** sea coherente. Es deliberado, porque el escenario 5 de
 * SC-LAB-001 no se rompe atacando el sistema, sino otorgando una combinacion
 * de permisos que nadie reviso.
 *
 * Prueba negativa 4 del prompt maestro, en su vertiente preventiva.
 */
describe('separacion de funciones (RNFS-007)', () => {
  it('ningun rol sembrado acumula asignar docencia y capturar calificaciones', () => {
    for (const rol of ROLES_BASE) {
      const conflictos = detectarConflictosSeparacion(MATRIZ_ROL_PERMISOS[rol]);
      expect(
        conflictos,
        `El rol "${rol}" acumula una combinacion prohibida: ` +
          conflictos.map((c) => `${c.permisoA} + ${c.permisoB}`).join(', '),
      ).toEqual([]);
    }
  });

  it('detecta el encadenamiento del escenario 5 de SC-LAB-001', () => {
    // El ataque concreto: el jefe de carrera se asigna un grupo, entra a
    // calificaciones —donde la verificacion responde correctamente que SI
    // esta autorizado—, altera notas y revierte la asignacion.
    const cuentaPeligrosa: Permiso[] = [
      'asignacion-docente:crear',
      'calificacion:crear',
      'calificacion:publicar',
    ];

    const conflictos = detectarConflictosSeparacion(cuentaPeligrosa);
    expect(conflictos.length).toBeGreaterThan(0);
  });

  it('detecta el conflicto aunque los permisos vengan de roles distintos', () => {
    // El camino por el que estas cosas se cuelan de verdad: dos roles inocuos
    // por separado que, sumados en una cuenta, forman la combinacion
    // prohibida. Por eso `UsuariosService.asignarRol` evalua los permisos
    // ACUMULADOS y no solo los del rol que se anade.
    const acumulados = [
      ...MATRIZ_ROL_PERMISOS['jefe-carrera'],
      ...MATRIZ_ROL_PERMISOS.profesor,
    ];

    const conflictos = detectarConflictosSeparacion(acumulados);
    expect(conflictos.length).toBeGreaterThan(0);
  });

  it('una combinacion legitima no produce falsos positivos', () => {
    // La prueba que evita que el control se vuelva inservible: si marcara
    // combinaciones normales, alguien terminaria desactivandolo.
    expect(detectarConflictosSeparacion(MATRIZ_ROL_PERMISOS.estudiante)).toEqual([]);
    expect(detectarConflictosSeparacion(MATRIZ_ROL_PERMISOS.profesor)).toEqual([]);
  });
});

describe('coherencia de la matriz rol-permiso (SC-SRS-001 §6)', () => {
  it('todo permiso de la matriz existe en el catalogo cerrado', () => {
    const catalogo = new Set<string>(PERMISOS);
    for (const rol of ROLES_BASE) {
      for (const permiso of MATRIZ_ROL_PERMISOS[rol]) {
        expect(catalogo.has(permiso), `Permiso desconocido en el rol ${rol}: ${permiso}`).toBe(true);
      }
    }
  });

  it('el administrador no tiene permisos academicos operativos', () => {
    // Administrar el sistema no es operar academicamente. Confundirlo es el
    // caso A de SC-LAB-003 §4: un requisito ambiguo que se resuelve al final,
    // cuando el modelo ya se construyo sobre la lectura permisiva.
    const admin = MATRIZ_ROL_PERMISOS.administrador;
    expect(admin).not.toContain('calificacion:crear');
    expect(admin).not.toContain('calificacion:publicar');
    expect(admin).not.toContain('grupo:crear');
    expect(admin).not.toContain('asignacion-docente:crear');
  });

  it('el estudiante no tiene ningun permiso de escritura sobre terceros', () => {
    const estudiante = MATRIZ_ROL_PERMISOS.estudiante;
    expect(estudiante).not.toContain('usuario:leer');
    expect(estudiante).not.toContain('usuario:modificar');
    expect(estudiante).not.toContain('calificacion:crear');
    expect(estudiante).not.toContain('auditoria:consultar');
  });

  /**
   * Combinaciones leer+modificar que SI son intencionales.
   *
   * Cada entrada es una decision que alguien tuvo que escribir aqui. Es el
   * punto de la prueba siguiente: no prohibir que un rol lea y escriba el
   * mismo recurso —a veces es justo su trabajo— sino que ninguna combinacion
   * de ese tipo exista **sin que nadie la haya decidido**.
   *
   * Es el caso A de SC-LAB-003 §4 convertido en control: "si el requisito
   * falta, alguien pregunta; si es ambiguo, cada quien lo completa en silencio
   * y de forma distinta, y nadie detecta el desacuerdo hasta que los
   * artefactos ya no coinciden".
   */
  const LECTURA_Y_ESCRITURA_INTENCIONAL: readonly `${RolBase}:${string}`[] = [
    // Cualquiera edita los campos habilitados de su propio perfil (RF-012).
    'estudiante:perfil',
    'profesor:perfil',
    'jefe-carrera:perfil',
    'administrador:perfil',
    'autoridad-academica:perfil',
    // El jefe de carrera crea y ajusta los grupos de SU programa: es
    // literalmente su atribucion (RF-023). El alcance no lo limita el permiso
    // sino el resolvedor `grupoDeMiPrograma`.
    'jefe-carrera:grupo',
    // El administrador gestiona el ciclo de vida de las cuentas (RF-013).
    'administrador:usuario',
    // Y el calendario academico (RF-021).
    'administrador:periodo',
    // Quien atiende solicitudes las lee y les cambia el estado (RF-062).
    'administrador:solicitud',
  ];

  it('toda combinacion leer+modificar esta declarada como intencional (RNFS-004)', () => {
    const noDeclaradas: string[] = [];

    for (const rol of ROLES_BASE) {
      const permisos = new Set<string>(MATRIZ_ROL_PERMISOS[rol]);
      for (const permiso of permisos) {
        if (!permiso.endsWith(':leer')) continue;
        const recurso = permiso.split(':')[0] ?? '';
        if (!permisos.has(`${recurso}:modificar`)) continue;

        const clave = `${rol}:${recurso}`;
        if (!LECTURA_Y_ESCRITURA_INTENCIONAL.includes(clave as `${RolBase}:${string}`)) {
          noDeclaradas.push(clave);
        }
      }
    }

    expect(
      noDeclaradas,
      'Estos roles pueden leer y modificar el mismo recurso sin que la ' +
        'combinacion este declarada. Si es intencional, agregala a ' +
        'LECTURA_Y_ESCRITURA_INTENCIONAL con su justificacion; si no, quita el ' +
        'permiso de escritura de la matriz.',
    ).toEqual([]);
  });

  it('la lista de excepciones no contiene entradas muertas', () => {
    // Sin esto, la lista crece y nadie la poda: una excepcion que ya no
    // corresponde a ninguna combinacion real es ruido que esconde las que si
    // importan.
    const reales = new Set<string>();
    for (const rol of ROLES_BASE) {
      const permisos = new Set<string>(MATRIZ_ROL_PERMISOS[rol]);
      for (const permiso of permisos) {
        if (!permiso.endsWith(':leer')) continue;
        const recurso = permiso.split(':')[0] ?? '';
        if (permisos.has(`${recurso}:modificar`)) reales.add(`${rol}:${recurso}`);
      }
    }

    const muertas = LECTURA_Y_ESCRITURA_INTENCIONAL.filter((e) => !reales.has(e));
    expect(muertas, 'Excepciones declaradas que ya no aplican a la matriz.').toEqual([]);
  });
});
