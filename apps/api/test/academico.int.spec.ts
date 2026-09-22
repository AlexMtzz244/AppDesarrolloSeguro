import type { INestApplication } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulid';
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
 * Pruebas negativas 2, 3, 4 y 5 del prompt maestro.
 *
 *   2. Profesor escribe en grupo ajeno o periodo cerrado: 403, sin mutacion.
 *   3. Profesor modifica calificacion publicada sin flujo de correccion.
 *   4. Jefe toca otro programa, genera choque o modifica periodo cerrado.
 *   5. Se crea/revierte asignacion y el profesor recien asignado captura:
 *      auditoria append-only y alerta.
 *
 * La 5 es la reconstruccion completa del ataque del escenario 5 de
 * SC-LAB-001, el que "no rompe ningun control, los usa".
 */
describe('dominio academico y calificaciones', () => {
  let entorno: AppDePrueba;
  let app: INestApplication;
  let prisma: PrismaClient;

  let programaISC: { id: string; idPublico: string };
  let programaIND: { id: string; idPublico: string };
  let periodoAbierto: { id: string; idPublico: string };
  let periodoCerrado: { id: string; idPublico: string };
  let grupoISC: { id: string; idPublico: string };
  let grupoIND: { id: string; idPublico: string };

  let jefeISC: UsuarioDePrueba;
  let jefeIND: UsuarioDePrueba;
  let profesorAsignado: UsuarioDePrueba;
  let profesorAjeno: UsuarioDePrueba;
  let estudiante: UsuarioDePrueba;

  let cookieJefeISC: string;
  let cookieProfesor: string;
  let cookieProfesorAjeno: string;

  beforeAll(async () => {
    entorno = await levantarApp();
    app = entorno.app;
    prisma = entorno.prisma;

    await limpiar(prisma);
    await sembrarRoles(prisma);

    programaISC = await prisma.programa.create({
      data: { idPublico: ulid(), clave: 'ISC', nombre: 'Sistemas Computacionales' },
      select: { id: true, idPublico: true },
    });
    programaIND = await prisma.programa.create({
      data: { idPublico: ulid(), clave: 'IND', nombre: 'Ingenieria Industrial' },
      select: { id: true, idPublico: true },
    });

    periodoAbierto = await prisma.periodo.create({
      data: {
        idPublico: ulid(),
        clave: '2026-2',
        inicia: new Date('2026-08-10'),
        termina: new Date('2026-12-18'),
        estado: 'abierto',
      },
      select: { id: true, idPublico: true },
    });
    periodoCerrado = await prisma.periodo.create({
      data: {
        idPublico: ulid(),
        clave: '2026-1',
        inicia: new Date('2026-01-15'),
        termina: new Date('2026-06-05'),
        estado: 'cerrado',
        cerradoEl: new Date('2026-06-20'),
      },
      select: { id: true, idPublico: true },
    });

    const materia = await prisma.materia.create({
      data: {
        idPublico: ulid(),
        clave: 'ISC-601',
        nombre: 'Desarrollo Seguro',
        creditos: 8,
        programaId: programaISC.id,
      },
    });
    const materiaIND = await prisma.materia.create({
      data: {
        idPublico: ulid(),
        clave: 'IND-401',
        nombre: 'Procesos',
        creditos: 6,
        programaId: programaIND.id,
      },
    });
    const aula = await prisma.aula.create({
      data: { idPublico: ulid(), clave: 'A-201', edificio: 'A', capacidad: 40 },
    });
    const aulaB = await prisma.aula.create({
      data: { idPublico: ulid(), clave: 'B-101', edificio: 'B', capacidad: 30 },
    });

    grupoISC = await prisma.grupo.create({
      data: {
        idPublico: ulid(),
        clave: 'ISC-601-A',
        programaId: programaISC.id,
        materiaId: materia.id,
        periodoId: periodoAbierto.id,
        aulaId: aula.id,
        cupo: 30,
        horario: { create: [{ dia: 'lunes', inicioMin: 420, finMin: 540 }] },
      },
      select: { id: true, idPublico: true },
    });

    grupoIND = await prisma.grupo.create({
      data: {
        idPublico: ulid(),
        clave: 'IND-401-A',
        programaId: programaIND.id,
        materiaId: materiaIND.id,
        periodoId: periodoAbierto.id,
        aulaId: aulaB.id,
        cupo: 25,
        horario: { create: [{ dia: 'martes', inicioMin: 420, finMin: 540 }] },
      },
      select: { id: true, idPublico: true },
    });

    jefeISC = await crearUsuario(prisma, 'jefe.isc@prueba.edu.mx', 'jefe-carrera', {
      programaId: programaISC.id,
    });
    jefeIND = await crearUsuario(prisma, 'jefe.ind@prueba.edu.mx', 'jefe-carrera', {
      programaId: programaIND.id,
    });
    profesorAsignado = await crearUsuario(prisma, 'prof.asignado@prueba.edu.mx', 'profesor');
    profesorAjeno = await crearUsuario(prisma, 'prof.ajeno@prueba.edu.mx', 'profesor');
    estudiante = await crearUsuario(prisma, 'alumno@prueba.edu.mx', 'estudiante', {
      matricula: 'ISC001',
    });

    await prisma.inscripcion.create({
      data: { idPublico: ulid(), grupoId: grupoISC.id, estudianteId: estudiante.id },
    });

    await prisma.asignacionDocente.create({
      data: {
        idPublico: ulid(),
        grupoId: grupoISC.id,
        profesorId: profesorAsignado.id,
        version: 1,
        desdeEl: new Date(Date.now() - 86_400_000),
        autorId: jefeISC.id,
        motivo: 'Asignacion inicial del periodo para las pruebas',
      },
    });

    cookieJefeISC = await iniciarSesion(app, jefeISC.correo);
    cookieProfesor = await iniciarSesion(app, profesorAsignado.correo);
    cookieProfesorAjeno = await iniciarSesion(app, profesorAjeno.correo);
  }, 90_000);

  afterAll(async () => {
    await entorno.cerrar();
  });

  // --- Prueba negativa 2 ---------------------------------------------------

  it('2. el profesor con asignacion vigente SI captura en su grupo', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/api/calificaciones/captura')
      .set('Cookie', cookieProfesor)
      .send({
        grupoId: grupoISC.idPublico,
        calificaciones: [{ estudianteId: estudiante.idPublico, valor: 85 }],
      });

    expect(respuesta.status).toBe(201);
  });

  it('2. el profesor SIN asignacion no escribe en ese grupo: 403 y sin mutacion', async () => {
    const antes = await prisma.calificacion.findMany({ where: { grupoId: grupoISC.id } });

    const respuesta = await request(app.getHttpServer())
      .post('/api/calificaciones/captura')
      .set('Cookie', cookieProfesorAjeno)
      .send({
        grupoId: grupoISC.idPublico,
        calificaciones: [{ estudianteId: estudiante.idPublico, valor: 100 }],
      });

    expect(respuesta.status).toBe(403);

    // El rol es correcto —es profesor— y la relacion no. Es exactamente la
    // distincion de SC-LAB-001 §5.3.
    const despues = await prisma.calificacion.findMany({ where: { grupoId: grupoISC.id } });
    expect(despues.map((c) => Number(c.valor))).toEqual(antes.map((c) => Number(c.valor)));
  });

  it('2. tampoco lee la lista de captura de un grupo ajeno', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/calificaciones/grupo/${grupoISC.idPublico}`)
      .set('Cookie', cookieProfesorAjeno);

    expect(respuesta.status).toBe(403);
  });

  it('2. una asignacion CERRADA deja de autorizar', async () => {
    const otroGrupo = await prisma.grupo.create({
      data: {
        idPublico: ulid(),
        clave: 'ISC-601-B',
        programaId: programaISC.id,
        materiaId: (await prisma.materia.findFirstOrThrow({ where: { clave: 'ISC-601' } })).id,
        periodoId: periodoAbierto.id,
        aulaId: (await prisma.aula.findFirstOrThrow({ where: { clave: 'A-201' } })).id,
        cupo: 20,
      },
      select: { id: true, idPublico: true },
    });

    // Asignacion ya vencida: la fila sigue ahi, pero `hastaEl` ya paso.
    await prisma.asignacionDocente.create({
      data: {
        idPublico: ulid(),
        grupoId: otroGrupo.id,
        profesorId: profesorAjeno.id,
        version: 1,
        desdeEl: new Date(Date.now() - 172_800_000),
        hastaEl: new Date(Date.now() - 86_400_000),
        autorId: jefeISC.id,
        motivo: 'Asignacion que ya termino su vigencia',
      },
    });

    const respuesta = await request(app.getHttpServer())
      .get(`/api/calificaciones/grupo/${otroGrupo.idPublico}`)
      .set('Cookie', cookieProfesorAjeno);

    expect(respuesta.status).toBe(403);
  });

  // --- Prueba negativa 3 ---------------------------------------------------

  it('3. el profesor no edita directamente una calificacion publicada', async () => {
    const calificacion = await prisma.calificacion.findFirstOrThrow({
      where: { grupoId: grupoISC.id, estudianteId: estudiante.id },
      select: { id: true, idPublico: true },
    });

    await request(app.getHttpServer())
      .post('/api/calificaciones/publicar')
      .set('Cookie', cookieProfesor)
      .send({ grupoId: grupoISC.idPublico, calificacionIds: [calificacion.idPublico] });

    const publicada = await prisma.calificacion.findUniqueOrThrow({
      where: { id: calificacion.id },
    });
    expect(publicada.estado).toBe('publicado');

    // Reintentar por el flujo ordinario de captura: la maquina de estados lo
    // rechaza. La unica salida de `publicado` es `corregido`, con otro permiso.
    const respuesta = await request(app.getHttpServer())
      .post('/api/calificaciones/captura')
      .set('Cookie', cookieProfesor)
      .send({
        grupoId: grupoISC.idPublico,
        calificaciones: [{ estudianteId: estudiante.idPublico, valor: 100 }],
      });

    expect(respuesta.status).toBe(409);

    const sinCambio = await prisma.calificacion.findUniqueOrThrow({
      where: { id: calificacion.id },
    });
    expect(Number(sinCambio.valor)).toBe(85);
    expect(sinCambio.estado).toBe('publicado');
  }, 30_000);

  it('3. el profesor tampoco tiene el permiso de correccion (RNFS-007)', async () => {
    const calificacion = await prisma.calificacion.findFirstOrThrow({
      where: { grupoId: grupoISC.id },
      select: { idPublico: true },
    });

    const respuesta = await request(app.getHttpServer())
      .post(`/api/calificaciones/${calificacion.idPublico}/corregir`)
      .set('Cookie', cookieProfesor)
      .send({
        calificacionId: calificacion.idPublico,
        valorNuevo: 100,
        motivo: 'Intento de correccion sin el permiso correspondiente',
      });

    // Quien captura no corrige. Es la separacion de funciones aplicada al
    // activo de mayor valor institucional.
    expect(respuesta.status).toBe(403);
  });

  it('3. toda version de la calificacion conserva el valor anterior (RF-045)', async () => {
    const calificacion = await prisma.calificacion.findFirstOrThrow({
      where: { grupoId: grupoISC.id },
      select: { id: true },
    });

    const versiones = await prisma.versionCalificacion.findMany({
      where: { calificacionId: calificacion.id },
      orderBy: { version: 'asc' },
    });

    expect(versiones.length).toBeGreaterThanOrEqual(2);
    for (const version of versiones.slice(1)) {
      // Sin esto "no existe forma de saber cual era la nota correcta ni
      // cuantos registros fueron tocados" (SC-LAB-001 §5.5).
      expect(version.valorAnterior).not.toBeNull();
    }
  });

  // --- Prueba negativa 4 ---------------------------------------------------

  it('4. el jefe no alcanza un grupo de otro programa: 403', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/grupos/${grupoIND.idPublico}/asignaciones`)
      .set('Cookie', cookieJefeISC);

    expect(respuesta.status).toBe(403);
  });

  it('4. el jefe no asigna profesor a un grupo de otro programa', async () => {
    const antes = await prisma.asignacionDocente.count({ where: { grupoId: grupoIND.id } });

    const respuesta = await request(app.getHttpServer())
      .post(`/api/grupos/${grupoIND.idPublico}/asignaciones`)
      .set('Cookie', cookieJefeISC)
      .send({
        grupoId: grupoIND.idPublico,
        profesorId: profesorAjeno.idPublico,
        desde: new Date().toISOString(),
        hasta: null,
        motivo: 'Intento de asignar en un programa que no me corresponde',
      });

    expect(respuesta.status).toBe(403);
    expect(await prisma.asignacionDocente.count({ where: { grupoId: grupoIND.id } })).toBe(antes);
  });

  it('4. el jefe no crea grupos en un periodo cerrado', async () => {
    const materia = await prisma.materia.findFirstOrThrow({ where: { clave: 'ISC-601' } });
    const aula = await prisma.aula.findFirstOrThrow({ where: { clave: 'A-201' } });

    const respuesta = await request(app.getHttpServer())
      .post('/api/grupos')
      .set('Cookie', cookieJefeISC)
      .send({
        clave: 'ISC-601-Z',
        materiaId: materia.idPublico,
        periodoId: periodoCerrado.idPublico,
        aulaId: aula.idPublico,
        cupo: 20,
        horario: [{ dia: 'viernes', horaInicio: '10:00', horaFin: '12:00' }],
        motivo: 'Intento de alta retroactiva sobre un semestre cerrado',
      });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.codigo).toBe('PERIODO_CERRADO');
  });

  it('4. el choque de aula lo rechaza la base de datos, no solo la aplicacion', async () => {
    const materia = await prisma.materia.findFirstOrThrow({ where: { clave: 'ISC-601' } });
    const aula = await prisma.aula.findFirstOrThrow({ where: { clave: 'A-201' } });

    // Mismo dia, misma aula, mismo periodo, horario traslapado con ISC-601-A.
    const respuesta = await request(app.getHttpServer())
      .post('/api/grupos')
      .set('Cookie', cookieJefeISC)
      .send({
        clave: 'ISC-601-C',
        materiaId: materia.idPublico,
        periodoId: periodoAbierto.idPublico,
        aulaId: aula.idPublico,
        cupo: 20,
        horario: [{ dia: 'lunes', horaInicio: '08:00', horaFin: '10:00' }],
        motivo: 'Verificacion de la restriccion de exclusion de aula',
      });

    // La restriccion de exclusion de Postgres es lo que cierra la condicion de
    // carrera: dos peticiones simultaneas pasarian ambas una comprobacion
    // previa en la aplicacion.
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.codigo).toBe('CHOQUE_HORARIO_AULA');
  });

  it('4. el jefe no puede asignarse a si mismo como profesor', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/api/grupos/${grupoISC.idPublico}/asignaciones`)
      .set('Cookie', cookieJefeISC)
      .send({
        grupoId: grupoISC.idPublico,
        profesorId: jefeISC.idPublico,
        desde: new Date().toISOString(),
        hasta: null,
        motivo: 'Intento de autoasignacion docente para capturar notas',
      });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.codigo).toBe('AUTOASIGNACION_DOCENTE');
  });

  // --- Prueba negativa 5 ---------------------------------------------------

  describe('5. asignacion creada y revertida (escenario 5 de SC-LAB-001)', () => {
    it('la asignacion se VERSIONA, nunca se sobrescribe (RF-031)', async () => {
      const antes = await prisma.asignacionDocente.count({ where: { grupoId: grupoISC.id } });

      const respuesta = await request(app.getHttpServer())
        .post(`/api/grupos/${grupoISC.idPublico}/asignaciones`)
        .set('Cookie', cookieJefeISC)
        .send({
          grupoId: grupoISC.idPublico,
          profesorId: profesorAjeno.idPublico,
          desde: new Date().toISOString(),
          hasta: null,
          motivo: 'Cambio de profesor titular a mitad del periodo',
        });

      expect(respuesta.status).toBe(201);

      // Se AGREGA una version; la anterior sigue existiendo con su `hastaEl`.
      const despues = await prisma.asignacionDocente.count({ where: { grupoId: grupoISC.id } });
      expect(despues).toBe(antes + 1);

      const cerradas = await prisma.asignacionDocente.count({
        where: { grupoId: grupoISC.id, hastaEl: { not: null } },
      });
      expect(cerradas).toBeGreaterThan(0);
    });

    it('solo hay UNA asignacion vigente por grupo', async () => {
      const vigentes = await prisma.asignacionDocente.count({
        where: { grupoId: grupoISC.id, hastaEl: null },
      });

      // Lo garantiza un indice unico parcial: si hubiera dos, "el grupo
      // pertenece a la asignacion vigente del profesor" dejaria de significar
      // algo.
      expect(vigentes).toBe(1);
    });

    it('el paso intermedio queda en el historial y en la bitacora', async () => {
      const historial = await request(app.getHttpServer())
        .get(`/api/grupos/${grupoISC.idPublico}/asignaciones`)
        .set('Cookie', cookieJefeISC);

      expect(historial.status).toBe(200);
      expect(historial.body.length).toBeGreaterThanOrEqual(2);

      const eventos = await prisma.eventoAuditoria.findMany({
        where: { accion: 'asignacion-docente.alta' },
        orderBy: { creadoEl: 'desc' },
      });

      expect(eventos.length).toBeGreaterThanOrEqual(1);
      // El `antes` conserva al profesor desplazado: es lo que permite
      // reconstruir quien estaba asignado en cada momento.
      expect(eventos[0]?.antes).toBeTruthy();
      expect(eventos[0]?.motivo).toBeTruthy();
    });

    it('el ataque completo queda reconstruible pese a terminar consistente', async () => {
      // Se revierte la asignacion: el sistema queda como estaba.
      const reversion = await request(app.getHttpServer())
        .post(`/api/grupos/${grupoISC.idPublico}/asignaciones/cerrar`)
        .set('Cookie', cookieJefeISC)
        .send({ motivo: 'Reversion de la asignacion temporal de prueba' });

      expect(reversion.status).toBe(201);

      // El estado final no delata nada: no hay asignacion vigente anomala.
      expect(
        await prisma.asignacionDocente.count({ where: { grupoId: grupoISC.id, hastaEl: null } }),
      ).toBe(0);

      // Pero el historial SI: "el ataque no rompe ningun control, los usa...
      // lo que queda es que el cambio sea visible, atribuible e irreversible
      // en el registro" (SC-LAB-001 escenario 5).
      const versiones = await prisma.asignacionDocente.findMany({
        where: { grupoId: grupoISC.id },
        orderBy: { version: 'asc' },
        select: { version: true, profesorId: true, desdeEl: true, hastaEl: true, autorId: true },
      });

      expect(versiones.length).toBeGreaterThanOrEqual(3);
      for (const version of versiones) {
        expect(version.autorId).toBeTruthy();
      }

      const cierre = await prisma.eventoAuditoria.findFirst({
        where: { accion: 'asignacion-docente.cierre' },
        orderBy: { creadoEl: 'desc' },
      });
      expect(cierre).not.toBeNull();
      // La duracion de la asignacion queda calculada en el evento: es el dato
      // que dispara la alerta `asignacion-revertida-pronto`.
      expect(JSON.stringify(cierre?.despues)).toContain('duracionMinutos');
    }, 30_000);
  });
});
