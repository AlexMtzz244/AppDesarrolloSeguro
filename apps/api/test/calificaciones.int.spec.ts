import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { ulid } from 'ulid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  crearUsuario,
  iniciarSesion,
  levantarApp,
  limpiar,
  sembrarRoles,
  type AppDePrueba,
  type UsuarioDePrueba,
} from './ayudas.js';

/**
 * Equivalente de `tests/test_security.py` de SC-LAB-006, sobre la app real.
 *
 * Cubre lo que `academico.int.spec.ts` no: valores invalidos que no deben dejar
 * rastro en la base (el caso `test_grade_invalid`), estudiante no inscrito y
 * lectura cruzada entre estudiantes. Las reglas puras se prueban aparte en
 * `permisos-calificacion.spec.ts` y `validadores.spec.ts`.
 */
describe('SC-LAB-006: validacion y permisos de calificaciones', () => {
  let entorno: AppDePrueba;
  let app: INestApplication;
  let prisma: PrismaClient;

  let grupo: { id: string; idPublico: string };
  let profesor: UsuarioDePrueba;
  let alumnoA: UsuarioDePrueba;
  let alumnoB: UsuarioDePrueba;
  let alumnoSinInscripcion: UsuarioDePrueba;

  let cookieProfesor: string;
  let cookieA: string;
  let cookieB: string;

  const contarCalificaciones = () => prisma.calificacion.count({ where: { grupoId: grupo.id } });
  const capturar = (cookie: string, calificaciones: unknown[]) =>
    request(app.getHttpServer())
      .post('/api/calificaciones/captura')
      .set('Cookie', cookie)
      .send({ grupoId: grupo.idPublico, calificaciones });

  beforeAll(async () => {
    entorno = await levantarApp();
    app = entorno.app;
    prisma = entorno.prisma;

    await limpiar(prisma);
    await sembrarRoles(prisma);

    const programa = await prisma.programa.create({
      data: { idPublico: ulid(), clave: 'ISC', nombre: 'Sistemas Computacionales' },
    });
    const periodo = await prisma.periodo.create({
      data: {
        idPublico: ulid(),
        clave: '2026-2',
        inicia: new Date('2026-08-10'),
        termina: new Date('2026-12-18'),
        estado: 'abierto',
      },
    });
    const materia = await prisma.materia.create({
      data: {
        idPublico: ulid(),
        clave: 'ISC-601',
        nombre: 'Desarrollo Seguro',
        creditos: 8,
        programaId: programa.id,
      },
    });
    const aula = await prisma.aula.create({
      data: { idPublico: ulid(), clave: 'A-201', edificio: 'A', capacidad: 40 },
    });
    grupo = await prisma.grupo.create({
      data: {
        idPublico: ulid(),
        clave: 'ISC-601-A',
        programaId: programa.id,
        materiaId: materia.id,
        periodoId: periodo.id,
        aulaId: aula.id,
        cupo: 30,
      },
      select: { id: true, idPublico: true },
    });

    const jefe = await crearUsuario(prisma, 'jefe@prueba.edu.mx', 'jefe-carrera', {
      programaId: programa.id,
    });
    profesor = await crearUsuario(prisma, 'profesor@prueba.edu.mx', 'profesor');
    alumnoA = await crearUsuario(prisma, 'a@prueba.edu.mx', 'estudiante', { matricula: 'LAB001' });
    alumnoB = await crearUsuario(prisma, 'b@prueba.edu.mx', 'estudiante', { matricula: 'LAB002' });
    alumnoSinInscripcion = await crearUsuario(prisma, 'c@prueba.edu.mx', 'estudiante', {
      matricula: 'LAB003',
    });

    for (const alumno of [alumnoA, alumnoB]) {
      await prisma.inscripcion.create({
        data: { idPublico: ulid(), grupoId: grupo.id, estudianteId: alumno.id },
      });
    }
    await prisma.asignacionDocente.create({
      data: {
        idPublico: ulid(),
        grupoId: grupo.id,
        profesorId: profesor.id,
        version: 1,
        desdeEl: new Date(Date.now() - 86_400_000),
        autorId: jefe.id,
        motivo: 'Asignacion inicial para las pruebas de SC-LAB-006',
      },
    });

    cookieProfesor = await iniciarSesion(app, profesor.correo);
    cookieA = await iniciarSesion(app, alumnoA.correo);
    cookieB = await iniciarSesion(app, alumnoB.correo);
  }, 90_000);

  afterAll(async () => {
    await entorno.cerrar();
  });

  // --- test_grade_invalid ---------------------------------------------------

  it.each([150, -1, 100.01, 'hola', '', '98.5', 'NaN', 'Infinity', null, true, 99.999, 1e-7])(
    'rechaza el valor %j con 400 y sin crear ninguna fila',
    async (valor) => {
      const antes = await contarCalificaciones();
      const respuesta = await capturar(cookieProfesor, [
        { estudianteId: alumnoA.idPublico, valor },
      ]);

      expect(respuesta.status).toBe(400);
      expect(await contarCalificaciones()).toBe(antes);
    },
  );

  it('un lote con UNA sola nota invalida no guarda ninguna', async () => {
    const antes = await contarCalificaciones();
    const respuesta = await capturar(cookieProfesor, [
      { estudianteId: alumnoA.idPublico, valor: 90 },
      { estudianteId: alumnoB.idPublico, valor: 99.999 },
    ]);

    expect(respuesta.status).toBe(400);
    expect(await contarCalificaciones()).toBe(antes);
  });

  // --- test_professor_own_group / estudiante inscrito ----------------------

  it('el profesor asignado captura valores limite validos tal cual (0.07 y 100)', async () => {
    const respuesta = await capturar(cookieProfesor, [
      { estudianteId: alumnoA.idPublico, valor: 0.07 },
      { estudianteId: alumnoB.idPublico, valor: 100 },
    ]);
    expect(respuesta.status).toBe(201);

    const guardadas = await prisma.calificacion.findMany({
      where: { grupoId: grupo.id },
      orderBy: { valor: 'asc' },
    });
    expect(guardadas.map((c) => c.valor.toString())).toEqual(['0.07', '100']);
  });

  it('el profesor asignado NO califica a un estudiante no inscrito: 403 sin mutacion', async () => {
    const antes = await contarCalificaciones();
    const respuesta = await capturar(cookieProfesor, [
      { estudianteId: alumnoSinInscripcion.idPublico, valor: 80 },
    ]);

    expect(respuesta.status).toBe(403);
    expect(await contarCalificaciones()).toBe(antes);
  });

  it('un lote con un no inscrito entre inscritos se revierte completo', async () => {
    const antes = (await prisma.calificacion.findMany({ where: { grupoId: grupo.id } })).map((c) =>
      c.valor.toString(),
    );
    const respuesta = await capturar(cookieProfesor, [
      { estudianteId: alumnoA.idPublico, valor: 55 },
      { estudianteId: alumnoSinInscripcion.idPublico, valor: 80 },
    ]);

    expect(respuesta.status).toBe(403);
    const despues = (await prisma.calificacion.findMany({ where: { grupoId: grupo.id } })).map((c) =>
      c.valor.toString(),
    );
    expect(despues.sort()).toEqual(antes.sort());
  });

  // --- test_student_cannot_modify ------------------------------------------

  it('un estudiante no captura calificaciones: 403 sin mutacion', async () => {
    const antes = await contarCalificaciones();
    const respuesta = await capturar(cookieA, [{ estudianteId: alumnoA.idPublico, valor: 100 }]);

    expect(respuesta.status).toBe(403);
    expect(await contarCalificaciones()).toBe(antes);
  });

  // --- test_student_cannot_read_other_student ------------------------------

  describe('lectura de calificaciones por estudiantes', () => {
    let calificacionA: string;
    let calificacionB: string;

    beforeAll(async () => {
      const filas = await prisma.calificacion.findMany({
        where: { grupoId: grupo.id },
        select: { idPublico: true, estudianteId: true },
      });
      calificacionA = filas.find((f) => f.estudianteId === alumnoA.id)!.idPublico;
      calificacionB = filas.find((f) => f.estudianteId === alumnoB.id)!.idPublico;
    });

    const historial = (cookie: string, id: string) =>
      request(app.getHttpServer()).get(`/api/calificaciones/${id}/historial`).set('Cookie', cookie);

    it('el estudiante NO ve su calificacion mientras sea borrador', async () => {
      expect((await historial(cookieA, calificacionA)).status).toBe(403);
    });

    it('tras publicar, el estudiante ve la propia pero no la de otro', async () => {
      const publicar = await request(app.getHttpServer())
        .post('/api/calificaciones/publicar')
        .set('Cookie', cookieProfesor)
        .send({ grupoId: grupo.idPublico, calificacionIds: [calificacionA, calificacionB] });
      expect(publicar.status).toBe(201);

      expect((await historial(cookieA, calificacionA)).status).toBe(200);
      expect((await historial(cookieA, calificacionB)).status).toBe(403);
      expect((await historial(cookieB, calificacionA)).status).toBe(403);
    });

    it('una calificacion inexistente responde igual que una ajena (RNFS-006)', async () => {
      const ajena = await historial(cookieA, calificacionB);
      const inexistente = await historial(cookieA, ulid());

      expect(inexistente.status).toBe(ajena.status);
      expect(inexistente.body.codigo).toBe(ajena.body.codigo);
    });

    it('el profesor asignado ve la calificacion de su grupo', async () => {
      expect((await historial(cookieProfesor, calificacionA)).status).toBe(200);
    });
  });
});
