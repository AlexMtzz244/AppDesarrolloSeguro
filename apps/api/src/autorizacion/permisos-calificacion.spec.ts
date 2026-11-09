import { describe, expect, it } from 'vitest';
import {
  asignacionEsVigente,
  puedeConsultarCalificacion,
  puedeCorregirCalificacion,
  puedeModificarCalificacion,
} from './permisos-calificacion.js';

/**
 * Equivalente de `test_professor_own_group`, `test_professor_other_group_forbidden`
 * y `test_student_*` de SC-LAB-006, sin base de datos: tablas de verdad de las
 * reglas puras. Las pruebas de integracion verifican que los resolvedores las
 * invoquen con los hechos correctos.
 */

const AHORA = new Date('2026-11-08T12:00:00Z');
const antes = (ms: number) => new Date(AHORA.getTime() - ms);
const despues = (ms: number) => new Date(AHORA.getTime() + ms);

describe('asignacionEsVigente', () => {
  it('vigente sin fecha de fin', () => {
    expect(asignacionEsVigente({ desdeEl: antes(1000), hastaEl: null }, AHORA)).toBe(true);
  });
  it('vigente con fin futuro', () => {
    expect(asignacionEsVigente({ desdeEl: antes(1000), hastaEl: despues(1000) }, AHORA)).toBe(true);
  });
  it('empieza exactamente ahora: vigente', () => {
    expect(asignacionEsVigente({ desdeEl: AHORA, hastaEl: null }, AHORA)).toBe(true);
  });
  it('termina exactamente ahora: ya no vigente (limite abierto)', () => {
    expect(asignacionEsVigente({ desdeEl: antes(1000), hastaEl: AHORA }, AHORA)).toBe(false);
  });
  it('terminada en el pasado', () => {
    expect(asignacionEsVigente({ desdeEl: antes(2000), hastaEl: antes(1000) }, AHORA)).toBe(false);
  });
  it('futura: todavia no cuenta', () => {
    expect(asignacionEsVigente({ desdeEl: despues(1000), hastaEl: null }, AHORA)).toBe(false);
  });
});

describe('puedeModificarCalificacion (deny by default)', () => {
  const bools = [true, false];
  const combinaciones = bools.flatMap((a) =>
    bools.flatMap((p) => bools.map((i) => ({ a, p, i }))),
  );

  it.each(combinaciones)(
    'asignacion=$a periodo=$p inscrito=$i',
    ({ a, p, i }) => {
      const d = puedeModificarCalificacion({
        tieneAsignacionVigente: a,
        periodoAbierto: p,
        estudianteInscrito: i,
      });
      expect(d.permitido).toBe(a && p && i);
    },
  );

  it('sin indicar inscripcion no la exige', () => {
    expect(
      puedeModificarCalificacion({ tieneAsignacionVigente: true, periodoAbierto: true }).permitido,
    ).toBe(true);
  });

  it('el motivo prioriza la relacion sobre el periodo', () => {
    const d = puedeModificarCalificacion({
      tieneAsignacionVigente: false,
      periodoAbierto: false,
      estudianteInscrito: false,
    });
    expect(d).toEqual({ permitido: false, motivoTecnico: 'sin-asignacion-vigente' });
  });

  it('distingue periodo cerrado de estudiante no inscrito', () => {
    const base = { tieneAsignacionVigente: true };
    expect(puedeModificarCalificacion({ ...base, periodoAbierto: false })).toMatchObject({
      motivoTecnico: 'periodo-cerrado',
    });
    expect(
      puedeModificarCalificacion({ ...base, periodoAbierto: true, estudianteInscrito: false }),
    ).toMatchObject({ motivoTecnico: 'estudiante-no-inscrito' });
  });
});

describe('puedeConsultarCalificacion', () => {
  it('el titular ve su calificacion publicada', () => {
    expect(
      puedeConsultarCalificacion({ esTitular: true, estado: 'publicado', profesorConAsignacionVigente: false })
        .permitido,
    ).toBe(true);
  });
  it('el titular ve una corregida', () => {
    expect(
      puedeConsultarCalificacion({ esTitular: true, estado: 'corregido', profesorConAsignacionVigente: false })
        .permitido,
    ).toBe(true);
  });
  it('el titular NO ve su borrador', () => {
    expect(
      puedeConsultarCalificacion({ esTitular: true, estado: 'borrador', profesorConAsignacionVigente: false }),
    ).toEqual({ permitido: false, motivoTecnico: 'calificacion-en-borrador' });
  });
  it('el profesor con asignacion vigente ve incluso borradores', () => {
    expect(
      puedeConsultarCalificacion({ esTitular: false, estado: 'borrador', profesorConAsignacionVigente: true })
        .permitido,
    ).toBe(true);
  });
  it('un tercero sin asignacion no ve nada', () => {
    for (const estado of ['borrador', 'publicado', 'corregido']) {
      expect(
        puedeConsultarCalificacion({ esTitular: false, estado, profesorConAsignacionVigente: false }),
      ).toEqual({ permitido: false, motivoTecnico: 'calificacion-ajena' });
    }
  });
});

describe('puedeCorregirCalificacion', () => {
  it('rechaza borradores', () => {
    expect(puedeCorregirCalificacion({ estado: 'borrador' }).permitido).toBe(false);
  });
  it.each(['publicado', 'corregido'])('permite %s', (estado) => {
    expect(puedeCorregirCalificacion({ estado }).permitido).toBe(true);
  });
});
