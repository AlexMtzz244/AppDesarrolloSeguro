import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
 * Pruebas negativas 1 y 6 del prompt maestro.
 *
 *   1. Estudiante A intenta consultar el perfil de B: 403 y evento.
 *   6. El cliente altera rol / permiso / ID: 403; los permisos vienen del
 *      servidor.
 *
 * Es el caso de Maria de SC-LAB-001 §3 y el escenario 4, convertidos en
 * pruebas automatizadas. Como dice SC-LAB-002 §3, fase Pruebas: sin el caso
 * negativo "el control existe hoy y desaparece en el siguiente refactor sin
 * que nadie lo note".
 */
describe('autorizacion por relacion usuario-recurso', () => {
  let entorno: AppDePrueba;
  let app: INestApplication;
  let prisma: PrismaClient;
  let estudianteA: UsuarioDePrueba;
  let estudianteB: UsuarioDePrueba;
  let administrador: UsuarioDePrueba;
  let cookieA: string;

  beforeAll(async () => {
    entorno = await levantarApp();
    app = entorno.app;
    prisma = entorno.prisma;

    await limpiar(prisma);
    await sembrarRoles(prisma);

    estudianteA = await crearUsuario(prisma, 'a@prueba.edu.mx', 'estudiante', {
      matricula: 'A001',
    });
    estudianteB = await crearUsuario(prisma, 'b@prueba.edu.mx', 'estudiante', {
      matricula: 'B001',
    });
    administrador = await crearUsuario(prisma, 'admin@prueba.edu.mx', 'administrador');

    cookieA = await iniciarSesion(app, estudianteA.correo);
  }, 60_000);

  afterAll(async () => {
    await entorno.cerrar();
  });

  // --- Prueba negativa 1 ---------------------------------------------------

  it('1. el estudiante consulta su propio perfil', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/perfiles/${estudianteA.idPublico}`)
      .set('Cookie', cookieA);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.correo).toBe(estudianteA.correo);
  });

  it('1. el estudiante A NO alcanza el perfil de B: 403', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/perfiles/${estudianteB.idPublico}`)
      .set('Cookie', cookieA);

    expect(respuesta.status).toBe(403);
    // La respuesta no menciona a B, ni su existencia, ni el motivo tecnico.
    expect(JSON.stringify(respuesta.body)).not.toContain(estudianteB.correo);
    expect(JSON.stringify(respuesta.body)).not.toContain(estudianteB.idPublico);
  });

  it('1. el acceso denegado queda en la bitacora (RNFS-033)', async () => {
    await request(app.getHttpServer())
      .get(`/api/perfiles/${estudianteB.idPublico}`)
      .set('Cookie', cookieA);

    const eventos = await prisma.eventoAuditoria.findMany({
      where: { actorId: estudianteA.id, resultado: 'denegado' },
      orderBy: { creadoEl: 'desc' },
      take: 1,
    });

    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.accion).toBe('acceso.denegado');
    expect(eventos[0]?.motivo).toBe('perfil-ajeno');
    expect(eventos[0]?.correlationId).toBeTruthy();
  });

  it('1. un identificador inexistente responde IGUAL que uno ajeno (RNFS-006)', async () => {
    const ajeno = await request(app.getHttpServer())
      .get(`/api/perfiles/${estudianteB.idPublico}`)
      .set('Cookie', cookieA);

    const inexistente = await request(app.getHttpServer())
      .get('/api/perfiles/01ARZ3NDEKTSV4RRFFQ69G5FAV')
      .set('Cookie', cookieA);

    // Si difirieran, recorrer identificadores revelaria cuales existen: la
    // enumeracion del caso de Maria por otra via.
    expect(inexistente.status).toBe(ajeno.status);
    expect(inexistente.body.codigo).toBe(ajeno.body.codigo);
    expect(inexistente.body.mensaje).toBe(ajeno.body.mensaje);
  });

  it('1. la enumeracion de identificadores no encuentra nada', async () => {
    const identificadores = [estudianteB.idPublico, administrador.idPublico];

    for (const id of identificadores) {
      const respuesta = await request(app.getHttpServer())
        .get(`/api/perfiles/${id}`)
        .set('Cookie', cookieA);
      expect(respuesta.status).toBe(403);
    }
  });

  // --- Prueba negativa 6 ---------------------------------------------------

  it('6. enviar un rol en el cuerpo no otorga nada', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Cookie', cookieA)
      .send({
        rol: 'administrador',
        roles: ['administrador'],
        permisos: ['usuario:crear', 'rol:administrar'],
        correo: 'intruso@prueba.edu.mx',
        nombre: 'Intruso',
        apellidoPaterno: 'Prueba',
        rolClave: 'administrador',
        motivo: 'Intento de escalada de privilegios desde el cliente',
        contrasenaInicial: 'UnaContrasenaLarga!1',
      });

    // El actor se recalcula desde la sesion en cada peticion; nada de lo que
    // venga en el cuerpo lo modifica (RNFS-003).
    expect(respuesta.status).toBe(403);

    const creado = await prisma.usuario.findUnique({
      where: { correo: 'intruso@prueba.edu.mx' },
    });
    expect(creado).toBeNull();
  });

  it('6. alterar la cookie de sesion invalida la sesion', async () => {
    const alterada = `${cookieA.slice(0, -4)}XXXX`;
    const respuesta = await request(app.getHttpServer())
      .get('/api/auth/yo')
      .set('Cookie', alterada);

    expect(respuesta.status).toBe(401);
  });

  it('6. una cabecera de suplantacion no cambia el actor', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/auth/yo')
      .set('Cookie', cookieA)
      .set('X-User-Id', administrador.idPublico)
      .set('X-Roles', 'administrador');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.correo).toBe(estudianteA.correo);
    expect(respuesta.body.roles).toEqual(['estudiante']);
    expect(respuesta.body.permisos).not.toContain('rol:administrar');
  });

  it('6. un permiso de lectura no habilita escritura (RNFS-004)', async () => {
    // El estudiante tiene `calificacion:leer`. La captura exige
    // `calificacion:crear`, que no tiene.
    const respuesta = await request(app.getHttpServer())
      .post('/api/calificaciones/captura')
      .set('Cookie', cookieA)
      .send({ grupoId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', calificaciones: [] });

    expect([400, 403]).toContain(respuesta.status);
  });

  it('6. ocultar el menu no protege el endpoint (RNFS-063)', async () => {
    // El frontend no muestra administracion al estudiante. Eso es UX; el
    // endpoint vuelve a verificar. SC-LAB-001 escenario 4, vulnerabilidad (a).
    const respuesta = await request(app.getHttpServer())
      .get('/api/usuarios')
      .set('Cookie', cookieA);

    expect(respuesta.status).toBe(403);
  });

  it('6. sin sesion, cualquier ruta protegida responde 401', async () => {
    for (const ruta of ['/api/auth/yo', '/api/usuarios', '/api/calificaciones/mias']) {
      const respuesta = await request(app.getHttpServer()).get(ruta);
      expect(respuesta.status, ruta).toBe(401);
    }
  });

  // --- Deny by default en caliente ----------------------------------------

  it('una ruta inexistente nunca responde 200', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/ruta/que/no/existe')
      .set('Cookie', cookieA);

    expect(respuesta.status).not.toBe(200);
  });

  it('el administrador necesita MFA verificada para administrar (RNFS-017)', async () => {
    const cookieAdmin = await iniciarSesion(app, administrador.correo);

    const sinMfa = await request(app.getHttpServer())
      .get('/api/usuarios')
      .set('Cookie', cookieAdmin);
    expect(sinMfa.status).toBe(403);

    await marcarMfaVerificada(prisma, administrador.id);

    const conMfa = await request(app.getHttpServer())
      .get('/api/usuarios')
      .set('Cookie', cookieAdmin);
    expect(conMfa.status).toBe(200);
  });
});
