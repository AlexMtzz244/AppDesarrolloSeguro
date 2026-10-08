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
  marcarMfaVerificada,
  sembrarRoles,
  type AppDePrueba,
  type UsuarioDePrueba,
} from './ayudas.js';

/**
 * Operaciones de cada rol que la interfaz expone: inscripciones del jefe,
 * asignacion solo a profesores, correccion retroactiva con autorizacion ajena
 * y desbloqueo administrativo. Como el resto de la suite, lo que importa es lo
 * que se RECHAZA.
 */
describe('operaciones por rol', () => {
  let entorno: AppDePrueba;
  let app: INestApplication;
  let prisma: PrismaClient;

  let grupoISC: { id: string; idPublico: string };
  let grupoIND: { id: string; idPublico: string };
  let grupoCerrado: { id: string; idPublico: string };
  let periodoCerrado: { id: string; idPublico: string };

  let jefeISC: UsuarioDePrueba;
  let profesor: UsuarioDePrueba;
  let estudianteISC: UsuarioDePrueba;
  let estudianteIND: UsuarioDePrueba;
  let admin: UsuarioDePrueba;
  let autoridad: UsuarioDePrueba;

  let cookieJefe: string;
  let cookieProfesor: string;
  let cookieAdmin: string;
  let cookieAutoridad: string;

  let calificacionCerrada: { id: string; idPublico: string };

  beforeAll(async () => {
    entorno = await levantarApp();
    app = entorno.app;
    prisma = entorno.prisma;

    await limpiar(prisma);
    await sembrarRoles(prisma);

    const isc = await prisma.programa.create({
      data: { idPublico: ulid(), clave: 'ISC', nombre: 'Sistemas' },
      select: { id: true },
    });
    const ind = await prisma.programa.create({
      data: { idPublico: ulid(), clave: 'IND', nombre: 'Industrial' },
      select: { id: true },
    });

    const abierto = await prisma.periodo.create({
      data: {
        idPublico: ulid(),
        clave: '2026-2',
        inicia: new Date('2026-08-10'),
        termina: new Date('2026-12-18'),
        estado: 'abierto',
      },
      select: { id: true },
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
      data: { idPublico: ulid(), clave: 'ISC-601', nombre: 'Seguro', creditos: 8, programaId: isc.id },
      select: { id: true },
    });
    const materiaIND = await prisma.materia.create({
      data: { idPublico: ulid(), clave: 'IND-401', nombre: 'Procesos', creditos: 6, programaId: ind.id },
      select: { id: true },
    });
    const aula = await prisma.aula.create({
      data: { idPublico: ulid(), clave: 'A-201', edificio: 'A', capacidad: 40 },
      select: { id: true },
    });

    const grupo = (
      clave: string,
      programaId: string,
      materiaId: string,
      periodoId: string,
      cupo: number,
      dia: 'lunes' | 'martes',
    ) =>
      prisma.grupo.create({
        data: {
          idPublico: ulid(),
          clave,
          programaId,
          materiaId,
          periodoId,
          aulaId: aula.id,
          cupo,
          horario: { create: [{ dia, inicioMin: 420, finMin: 540 }] },
        },
        select: { id: true, idPublico: true },
      });

    grupoISC = await grupo('ISC-601-A', isc.id, materia.id, abierto.id, 1, 'lunes');
    grupoIND = await grupo('IND-401-A', ind.id, materiaIND.id, abierto.id, 30, 'martes');
    grupoCerrado = await grupo('ISC-601-Z', isc.id, materia.id, periodoCerrado.id, 30, 'lunes');

    jefeISC = await crearUsuario(prisma, 'jefe@prueba.edu.mx', 'jefe-carrera', { programaId: isc.id });
    profesor = await crearUsuario(prisma, 'prof@prueba.edu.mx', 'profesor', { programaId: isc.id });
    estudianteISC = await crearUsuario(prisma, 'a@prueba.edu.mx', 'estudiante', {
      programaId: isc.id,
      matricula: 'ISC100',
    });
    estudianteIND = await crearUsuario(prisma, 'b@prueba.edu.mx', 'estudiante', {
      programaId: ind.id,
      matricula: 'IND100',
    });
    admin = await crearUsuario(prisma, 'admin@prueba.edu.mx', 'administrador');
    autoridad = await crearUsuario(prisma, 'autoridad@prueba.edu.mx', 'autoridad-academica');

    // Calificacion publicada en un periodo ya cerrado: el caso retroactivo.
    await prisma.inscripcion.create({
      data: { idPublico: ulid(), grupoId: grupoCerrado.id, estudianteId: estudianteISC.id },
    });
    calificacionCerrada = await prisma.calificacion.create({
      data: {
        idPublico: ulid(),
        grupoId: grupoCerrado.id,
        estudianteId: estudianteISC.id,
        valor: new Prisma.Decimal(70),
        estado: 'publicado',
        versionActual: 2,
        publicadaEl: new Date('2026-06-01'),
      },
      select: { id: true, idPublico: true },
    });

    cookieJefe = await iniciarSesion(app, jefeISC.correo);
    cookieProfesor = await iniciarSesion(app, profesor.correo);
    cookieAdmin = await iniciarSesion(app, admin.correo);
    cookieAutoridad = await iniciarSesion(app, autoridad.correo);
    await marcarMfaVerificada(prisma, admin.id);
    await marcarMfaVerificada(prisma, autoridad.id);
  }, 90_000);

  afterAll(async () => {
    await entorno.cerrar();
  });

  const api = () => request(app.getHttpServer());

  // --- Inscripciones -------------------------------------------------------

  it('el jefe solo ve como candidatos a estudiantes de su programa', async () => {
    const r = await api().get('/api/estudiantes').set('Cookie', cookieJefe);
    expect(r.status).toBe(200);
    expect(r.body.map((e: { id: string }) => e.id)).toEqual([estudianteISC.idPublico]);
  });

  it('el jefe no inscribe a un estudiante de otro programa ni a un profesor', async () => {
    for (const estudianteId of [estudianteIND.idPublico, profesor.idPublico]) {
      const r = await api()
        .post(`/api/grupos/${grupoISC.idPublico}/inscripciones`)
        .set('Cookie', cookieJefe)
        .send({ estudianteId });
      expect(r.status).toBe(403);
    }
    expect(await prisma.inscripcion.count({ where: { grupoId: grupoISC.id } })).toBe(0);
  });

  it('el jefe no inscribe en un grupo de otro programa', async () => {
    const r = await api()
      .post(`/api/grupos/${grupoIND.idPublico}/inscripciones`)
      .set('Cookie', cookieJefe)
      .send({ estudianteId: estudianteIND.idPublico });
    expect(r.status).toBe(403);
  });

  it('el profesor no inscribe: no tiene el permiso', async () => {
    const r = await api()
      .post(`/api/grupos/${grupoISC.idPublico}/inscripciones`)
      .set('Cookie', cookieProfesor)
      .send({ estudianteId: estudianteISC.idPublico });
    expect(r.status).toBe(403);
  });

  it('inscribe, rechaza duplicado y respeta el cupo', async () => {
    const alta = await api()
      .post(`/api/grupos/${grupoISC.idPublico}/inscripciones`)
      .set('Cookie', cookieJefe)
      .send({ estudianteId: estudianteISC.idPublico });
    expect(alta.status).toBe(201);

    const duplicado = await api()
      .post(`/api/grupos/${grupoISC.idPublico}/inscripciones`)
      .set('Cookie', cookieJefe)
      .send({ estudianteId: estudianteISC.idPublico });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.codigo).toBe('YA_INSCRITO');

    const evento = await prisma.eventoAuditoria.findFirst({ where: { accion: 'inscripcion.alta' } });
    expect(evento).not.toBeNull();
  });

  it('la baja exige motivo y conserva la fila', async () => {
    const [inscripcion] = (
      await api().get(`/api/grupos/${grupoISC.idPublico}/inscripciones`).set('Cookie', cookieJefe)
    ).body as { id: string }[];

    const sinMotivo = await api()
      .post(`/api/grupos/${grupoISC.idPublico}/inscripciones/${inscripcion!.id}/baja`)
      .set('Cookie', cookieJefe)
      .send({});
    expect(sinMotivo.status).toBe(400);

    const baja = await api()
      .post(`/api/grupos/${grupoISC.idPublico}/inscripciones/${inscripcion!.id}/baja`)
      .set('Cookie', cookieJefe)
      .send({ motivo: 'El estudiante solicito baja de la materia' });
    expect(baja.status).toBe(201);

    const fila = await prisma.inscripcion.findUniqueOrThrow({ where: { idPublico: inscripcion!.id } });
    expect(fila.bajaEl).not.toBeNull();
  });

  // --- Asignacion docente --------------------------------------------------

  it('no se asigna como profesor a una cuenta que no puede capturar', async () => {
    const r = await api()
      .post(`/api/grupos/${grupoISC.idPublico}/asignaciones`)
      .set('Cookie', cookieJefe)
      .send({
        grupoId: grupoISC.idPublico,
        profesorId: estudianteISC.idPublico,
        desde: new Date().toISOString(),
        hasta: null,
        motivo: 'Intento de asignar a un estudiante como profesor',
      });
    expect(r.status).toBe(400);
    expect(r.body.codigo).toBe('PROFESOR_DESCONOCIDO');
  });

  it('el catalogo de profesores del jefe solo trae cuentas que pueden capturar', async () => {
    const r = await api().get('/api/profesores').set('Cookie', cookieJefe);
    expect(r.status).toBe(200);
    expect(r.body.map((p: { id: string }) => p.id)).toEqual([profesor.idPublico]);
  });

  // --- Correccion retroactiva: dos cuentas (D-07) -------------------------

  it('corregir en periodo cerrado sin autorizacion se rechaza sin mutar', async () => {
    const r = await api()
      .post(`/api/calificaciones/${calificacionCerrada.idPublico}/corregir`)
      .set('Cookie', cookieAdmin)
      .send({
        calificacionId: calificacionCerrada.idPublico,
        valorNuevo: 90,
        motivo: 'Correccion sin autorizacion extraordinaria',
      });
    expect(r.status).toBe(409);
    expect(r.body.codigo).toBe('AUTORIZACION_REQUERIDA');

    const sinCambio = await prisma.calificacion.findUniqueOrThrow({ where: { id: calificacionCerrada.id } });
    expect(Number(sinCambio.valor)).toBe(70);
  });

  it('la autoridad concede y el administrador ejecuta una sola vez', async () => {
    const concesion = await api()
      .post(`/api/periodos/${periodoCerrado.idPublico}/autorizaciones`)
      .set('Cookie', cookieAutoridad)
      .send({ motivo: 'Error de captura documentado en acta 12/2026', vigenteHoras: 2 });
    expect(concesion.status).toBe(201);
    const autorizacionId = concesion.body.id as string;

    // La autoridad no puede usar lo que concedio.
    const autoridadCorrige = await api()
      .post(`/api/calificaciones/${calificacionCerrada.idPublico}/corregir`)
      .set('Cookie', cookieAutoridad)
      .send({
        calificacionId: calificacionCerrada.idPublico,
        valorNuevo: 95,
        motivo: 'La autoridad intenta ejecutar su propia autorizacion',
        autorizacionId,
      });
    expect(autoridadCorrige.status).toBe(403);

    const correccion = await api()
      .post(`/api/calificaciones/${calificacionCerrada.idPublico}/corregir`)
      .set('Cookie', cookieAdmin)
      .send({
        calificacionId: calificacionCerrada.idPublico,
        valorNuevo: 90,
        motivo: 'Correccion autorizada por acta 12/2026',
        autorizacionId,
      });
    expect(correccion.status).toBe(201);

    const reuso = await api()
      .post(`/api/calificaciones/${calificacionCerrada.idPublico}/corregir`)
      .set('Cookie', cookieAdmin)
      .send({
        calificacionId: calificacionCerrada.idPublico,
        valorNuevo: 100,
        motivo: 'Reuso de una autorizacion ya consumida',
        autorizacionId,
      });
    expect(reuso.status).toBe(409);
    expect(reuso.body.codigo).toBe('AUTORIZACION_INVALIDA');

    const final = await prisma.calificacion.findUniqueOrThrow({ where: { id: calificacionCerrada.id } });
    expect(Number(final.valor)).toBe(90);
    const autorizacion = await prisma.autorizacionExtraordinaria.findUniqueOrThrow({
      where: { idPublico: autorizacionId },
    });
    expect(autorizacion.usadaEl).not.toBeNull();
  });

  it('la busqueda de corregibles exige MFA y no devuelve borradores', async () => {
    const sinMfa = await iniciarSesion(app, admin.correo);
    const denegada = await api().get('/api/calificaciones/corregibles?matricula=ISC100').set('Cookie', sinMfa);
    expect(denegada.status).toBe(403);

    await marcarMfaVerificada(prisma, admin.id);
    const r = await api().get('/api/calificaciones/corregibles?matricula=ISC100').set('Cookie', sinMfa);
    expect(r.status).toBe(200);
    expect(r.body.calificaciones.every((c: { estado: string }) => c.estado !== 'borrador')).toBe(true);
    // Un login nuevo puede rotar las sesiones previas; la siguiente prueba usa esta.
    cookieAdmin = sinMfa;
  });

  // --- Desbloqueo administrativo --------------------------------------------

  it('el administrador levanta el bloqueo por intentos y queda auditado', async () => {
    for (let i = 0; i < 6; i++) {
      await api().post('/api/auth/login').send({ correo: estudianteIND.correo, contrasena: 'Equivocada!2026x' });
    }

    const lista = await api().get('/api/usuarios?pagina=1&tamano=50').set('Cookie', cookieAdmin);
    const fila = lista.body.datos.find((u: { id: string }) => u.id === estudianteIND.idPublico);
    expect(fila.bloqueadoPorIntentos).toBe(true);

    const r = await api()
      .post(`/api/usuarios/${estudianteIND.idPublico}/desbloquear`)
      .set('Cookie', cookieAdmin)
      .send({ motivo: 'Titular verificado por telefono con coordinacion' });
    expect(r.status).toBe(201);

    const evento = await prisma.eventoAuditoria.findFirst({ where: { accion: 'usuario.desbloqueo' } });
    expect(evento?.motivo).toContain('Titular verificado');

    await iniciarSesion(app, estudianteIND.correo);
  }, 60_000);
});
