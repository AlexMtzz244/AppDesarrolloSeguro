import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { ulid } from 'ulid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CONTRASENA,
  crearUsuario,
  iniciarSesion,
  levantarApp,
  limpiar,
  sembrarRoles,
  type AppDePrueba,
  type UsuarioDePrueba,
} from './ayudas.js';

/**
 * SC-LAB-007 (REST: 200 / 400 / 401 / 403 y CSRF) y SC-LAB-008 (cliente movil
 * y sesion) trasladados a la aplicacion real.
 *
 * La guia del laboratorio usa una interfaz Flask con profe_ana, profe_luis,
 * alumna_eli y alumno_paz. Aqui los papeles son los mismos sobre SecureCampus:
 *
 *   profe_ana  -> `profesor`     asignado al grupo PROPIO
 *   profe_luis -> `otroProfesor` asignado al grupo AJENO
 *   alumna_eli -> `alumnaEli`    inscrita en el grupo propio
 *   alumno_paz -> `alumnoPaz`    inscrito en el grupo ajeno
 *
 * GraphQL no aplica: la aplicacion expone solo REST (ver la nota de alcance en
 * docs/security/SC-LAB-007-008-integracion-securecampus.md).
 */
describe('SC-LAB-007/008: matriz HTTP, CSRF y sesion', () => {
  let entorno: AppDePrueba;
  let app: INestApplication;
  let prisma: PrismaClient;

  let grupoPropio: { id: string; idPublico: string };
  let grupoAjeno: { id: string; idPublico: string };
  let profesor: UsuarioDePrueba;
  let alumnaEli: UsuarioDePrueba;
  let alumnoPaz: UsuarioDePrueba;

  let cookieProfesor: string;
  let cookieEli: string;
  let cookieOtroProfesor: string;

  const ORIGEN_FRONTEND = 'http://localhost:3000';
  const ORIGEN_ATACANTE = 'https://sitio-malicioso.example';

  const contar = () => prisma.calificacion.count();
  // Capturar de nuevo al mismo estudiante actualiza la fila, no crea otra: para
  // saber si una peticion cambio algo se compara el valor guardado.
  const valorDeEli = async () =>
    (await prisma.calificacion.findFirstOrThrow({ where: { estudianteId: alumnaEli.id } })).valor.toString();
  const capturar = (cookie: string | null, grupoId: string, estudianteId: string, valor: unknown) => {
    const peticion = request(app.getHttpServer())
      .post('/api/calificaciones/captura')
      .send({ grupoId, calificaciones: [{ estudianteId, valor }] });
    return cookie ? peticion.set('Cookie', cookie) : peticion;
  };

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

    const crearGrupo = async (clave: string, aulaClave: string) => {
      const aula = await prisma.aula.create({
        data: { idPublico: ulid(), clave: aulaClave, edificio: 'A', capacidad: 40 },
      });
      return prisma.grupo.create({
        data: {
          idPublico: ulid(),
          clave,
          programaId: programa.id,
          materiaId: materia.id,
          periodoId: periodo.id,
          aulaId: aula.id,
          cupo: 30,
        },
        select: { id: true, idPublico: true },
      });
    };
    grupoPropio = await crearGrupo('ISC-601-A', 'A-201');
    grupoAjeno = await crearGrupo('ISC-601-B', 'A-202');

    const jefe = await crearUsuario(prisma, 'jefe@prueba.edu.mx', 'jefe-carrera', {
      programaId: programa.id,
    });
    profesor = await crearUsuario(prisma, 'profe.ana@prueba.edu.mx', 'profesor');
    const otroProfesor = await crearUsuario(prisma, 'profe.luis@prueba.edu.mx', 'profesor');
    alumnaEli = await crearUsuario(prisma, 'alumna.eli@prueba.edu.mx', 'estudiante', {
      matricula: 'LAB701',
    });
    alumnoPaz = await crearUsuario(prisma, 'alumno.paz@prueba.edu.mx', 'estudiante', {
      matricula: 'LAB702',
    });

    await prisma.inscripcion.create({
      data: { idPublico: ulid(), grupoId: grupoPropio.id, estudianteId: alumnaEli.id },
    });
    await prisma.inscripcion.create({
      data: { idPublico: ulid(), grupoId: grupoAjeno.id, estudianteId: alumnoPaz.id },
    });
    for (const [grupo, docente] of [
      [grupoPropio, profesor],
      [grupoAjeno, otroProfesor],
    ] as const) {
      await prisma.asignacionDocente.create({
        data: {
          idPublico: ulid(),
          grupoId: grupo.id,
          profesorId: docente.id,
          version: 1,
          desdeEl: new Date(Date.now() - 86_400_000),
          autorId: jefe.id,
          motivo: 'Asignacion inicial para las pruebas de SC-LAB-007',
        },
      });
    }

    cookieProfesor = await iniciarSesion(app, profesor.correo);
    cookieEli = await iniciarSesion(app, alumnaEli.correo);
    cookieOtroProfesor = await iniciarSesion(app, otroProfesor.correo);
  }, 90_000);

  afterAll(async () => {
    await entorno.cerrar();
  });

  // --- SC-LAB-007 A/B/C: la misma sesion, distinto recurso, distinto codigo --

  describe('matriz de codigos (experiencias A, B y C)', () => {
    const lista = (cookie: string | null, grupoId: string) => {
      const peticion = request(app.getHttpServer()).get(`/api/calificaciones/grupo/${grupoId}`);
      return cookie ? peticion.set('Cookie', cookie) : peticion;
    };

    it('A. GET del grupo propio responde 200; el grupo ajeno, 403; sin sesion, 401', async () => {
      expect((await lista(cookieProfesor, grupoPropio.idPublico)).status).toBe(200);
      expect((await lista(cookieProfesor, grupoAjeno.idPublico)).status).toBe(403);
      expect((await lista(null, grupoPropio.idPublico)).status).toBe(401);
    });

    it('B. la captura de 88.50 responde 201 y se guarda tal cual', async () => {
      const antes = await contar();
      const r = await capturar(cookieProfesor, grupoPropio.idPublico, alumnaEli.idPublico, 88.5);

      expect(r.status).toBe(201);
      expect(await contar()).toBe(antes + 1);
      const fila = await prisma.calificacion.findFirstOrThrow({
        where: { estudianteId: alumnaEli.id },
      });
      expect(fila.valor.toString()).toBe('88.5');
    });

    it('B. la captura en el grupo ajeno responde 403 y no deja fila', async () => {
      const antes = await contar();
      const r = await capturar(cookieProfesor, grupoAjeno.idPublico, alumnoPaz.idPublico, 88.5);

      expect(r.status).toBe(403);
      expect(await contar()).toBe(antes);
    });

    it('B. el valor 150 responde 400 y no deja fila', async () => {
      const antes = await contar();
      const r = await capturar(cookieProfesor, grupoPropio.idPublico, alumnaEli.idPublico, 150);

      expect(r.status).toBe(400);
      expect(await contar()).toBe(antes);
    });

    it('B. sin sesion la captura responde 401 y no deja fila', async () => {
      const antes = await contar();
      const r = await capturar(null, grupoPropio.idPublico, alumnaEli.idPublico, 88.5);

      expect(r.status).toBe(401);
      expect(await contar()).toBe(antes);
    });

    it('C. la alumna es dueña de la calificacion y aun asi no la modifica: 403', async () => {
      const antes = await contar();
      const r = await capturar(cookieEli, grupoPropio.idPublico, alumnaEli.idPublico, 100);

      expect(r.status).toBe(403);
      expect(await contar()).toBe(antes);
    });

    it('C. cambiar el identificador de la ruta no abre la calificacion de otra persona', async () => {
      // La calificacion de Paz la captura y publica su propio profesor, por la
      // API real: asi existe y esta publicada, y Eli no tiene relacion con ella.
      const captura = await capturar(cookieOtroProfesor, grupoAjeno.idPublico, alumnoPaz.idPublico, 70);
      expect(captura.status).toBe(201);
      const ajena = await prisma.calificacion.findFirstOrThrow({
        where: { estudianteId: alumnoPaz.id },
        select: { idPublico: true },
      });
      const publicada = await request(app.getHttpServer())
        .post('/api/calificaciones/publicar')
        .set('Cookie', cookieOtroProfesor)
        .send({ grupoId: grupoAjeno.idPublico, calificacionIds: [ajena.idPublico] });
      expect(publicada.status).toBe(201);

      const r = await request(app.getHttpServer())
        .get(`/api/calificaciones/${ajena.idPublico}/historial`)
        .set('Cookie', cookieEli);

      expect(r.status).toBe(403);
    });
  });

  // --- SC-LAB-007 §11: el PUT del laboratorio exige X-CSRF-Token -------------
  // En SecureCampus la defensa es la verificacion de origen (origen.guard.ts).

  describe('CSRF: una peticion de otro origen no cambia nada', () => {
    it('captura con sesion valida pero Origin ajeno: 403 y el valor guardado no cambia', async () => {
      const antes = await valorDeEli();
      const r = await capturar(cookieProfesor, grupoPropio.idPublico, alumnaEli.idPublico, 91)
        .set('Origin', ORIGEN_ATACANTE);

      expect(r.status).toBe(403);
      expect(await valorDeEli()).toBe(antes);
    });

    it('la misma captura desde el origen del frontend procede y cambia el valor', async () => {
      const r = await capturar(cookieProfesor, grupoPropio.idPublico, alumnaEli.idPublico, 91)
        .set('Origin', ORIGEN_FRONTEND);

      expect(r.status).toBe(201);
      expect(await valorDeEli()).toBe('91');
    });

    it('Origin: null y Sec-Fetch-Site: cross-site tambien se rechazan', async () => {
      const antes = await valorDeEli();
      const conNull = await capturar(cookieProfesor, grupoPropio.idPublico, alumnaEli.idPublico, 92)
        .set('Origin', 'null');
      const crossSite = await capturar(cookieProfesor, grupoPropio.idPublico, alumnaEli.idPublico, 92)
        .set('Sec-Fetch-Site', 'cross-site');

      expect(conNull.status).toBe(403);
      expect(crossSite.status).toBe(403);
      expect(await valorDeEli()).toBe(antes);
    });

    it('un origen ajeno no puede cerrar la sesion de la persona (logout CSRF)', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookieEli)
        .set('Origin', ORIGEN_ATACANTE);
      expect(r.status).toBe(403);

      const sigueViva = await request(app.getHttpServer()).get('/api/auth/yo').set('Cookie', cookieEli);
      expect(sigueViva.status).toBe(200);
    });

    it('el inicio de sesion desde un origen ajeno se rechaza y no emite cookie (login CSRF)', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', ORIGEN_ATACANTE)
        .send({ correo: alumnaEli.correo, contrasena: CONTRASENA });

      expect(r.status).toBe(403);
      expect(r.headers['set-cookie']).toBeUndefined();
    });

    it('las lecturas no se bloquean por el origen (solo CORS limita leerlas)', async () => {
      const r = await request(app.getHttpServer())
        .get('/api/auth/yo')
        .set('Cookie', cookieEli)
        .set('Origin', ORIGEN_ATACANTE);

      expect(r.status).toBe(200);
    });
  });

  // --- SC-LAB-008: la sesion vive en una cookie, no en almacenamiento --------

  describe('sesion del cliente: cookie HttpOnly y nada que guardar (SC-LAB-008, pasos 4 y 6)', () => {
    it('la cookie lleva HttpOnly, Secure, SameSite=Lax y Path=/', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ correo: alumnaEli.correo, contrasena: CONTRASENA });
      const cookies = ([] as string[]).concat(r.headers['set-cookie'] ?? []);
      const cookie = cookies.find((c) => c.startsWith('sc_sesion='));

      expect(r.status).toBe(200);
      expect(cookie).toBeDefined();
      for (const atributo of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) {
        expect(cookie).toContain(atributo);
      }
    });

    it('el token de sesion no aparece en ningun cuerpo JSON: JavaScript no tiene nada que leer', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ correo: alumnaEli.correo, contrasena: CONTRASENA });
      const cookie = ([] as string[])
        .concat(login.headers['set-cookie'] ?? [])
        .find((c) => c.startsWith('sc_sesion='))!;
      const token = decodeURIComponent(cookie.split(';')[0]!.split('=')[1]!);
      expect(token.length).toBeGreaterThanOrEqual(32);

      const yo = await request(app.getHttpServer())
        .get('/api/auth/yo')
        .set('Cookie', cookie.split(';')[0]!);

      expect(JSON.stringify(login.body)).not.toContain(token);
      expect(JSON.stringify(yo.body)).not.toContain(token);
    });
  });
});
