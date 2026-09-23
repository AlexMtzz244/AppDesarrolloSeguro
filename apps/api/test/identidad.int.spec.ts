import { createHash, randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
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
 * Pruebas negativas 7, 8 y 11 del prompt maestro.
 *
 *    7. Credential stuffing y password spraying activan limites, retardo y
 *       alerta, sin enumerar.
 *    8. Enlace de recuperacion reutilizado, vencido o sustituido: rechazo sin
 *       revelar cuenta.
 *   11. Sesion rota tras login; el cambio de contrasena revoca todas.
 *
 * El grupo 8 es el caso guiado de SC-LAB-003 §3 — RF-010 — verificado.
 */
describe('identidad, sesion y recuperacion', () => {
  let entorno: AppDePrueba;
  let app: INestApplication;
  let prisma: PrismaClient;
  let usuario: UsuarioDePrueba;

  beforeAll(async () => {
    entorno = await levantarApp();
    app = entorno.app;
    prisma = entorno.prisma;

    await limpiar(prisma);
    await sembrarRoles(prisma);
    usuario = await crearUsuario(prisma, 'identidad@prueba.edu.mx', 'estudiante');
  }, 60_000);

  afterAll(async () => {
    await entorno.cerrar();
  });

  // --- Prueba negativa 7 ---------------------------------------------------

  it('7. credencial incorrecta y usuario inexistente responden IGUAL', async () => {
    const inexistente = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ correo: 'no.existe@prueba.edu.mx', contrasena: 'ContrasenaIncorrecta1' });

    const incorrecta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ correo: usuario.correo, contrasena: 'ContrasenaIncorrecta1' });

    expect(inexistente.status).toBe(incorrecta.status);
    expect(inexistente.body.codigo).toBe(incorrecta.body.codigo);
    expect(inexistente.body.mensaje).toBe(incorrecta.body.mensaje);
    // El mensaje no debe permitir deducir nada de la cuenta.
    expect(inexistente.body.mensaje).not.toMatch(/usuario|cuenta|existe|registrad/i);
  });

  it('7. la latencia tampoco distingue si la cuenta existe (RNFS-016)', async () => {
    const medir = async (correo: string): Promise<number> => {
      const inicio = Date.now();
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ correo, contrasena: 'OtraIncorrecta12' });
      return Date.now() - inicio;
    };

    const tInexistente = await medir('tampoco.existe@prueba.edu.mx');
    const tExistente = await medir(usuario.correo);

    // Con el senuelo de Argon2 y el piso de latencia uniforme, ambas rutas
    // tardan lo mismo dentro de un margen amplio. Sin el senuelo, la ruta del
    // usuario inexistente seria cientos de milisegundos mas rapida.
    expect(Math.abs(tExistente - tInexistente)).toBeLessThan(600);
  }, 30_000);

  it('7. el limite por cuenta se activa y responde 429', async () => {
    const correo = 'objetivo@prueba.edu.mx';
    await crearUsuario(prisma, correo, 'estudiante');

    const codigos: number[] = [];
    for (let i = 0; i < 8; i++) {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ correo, contrasena: `intento-invalido-${i}` });
      codigos.push(respuesta.status);
    }

    expect(codigos).toContain(429);
  }, 60_000);

  it('7. los intentos fallidos quedan como evidencia en Postgres', async () => {
    const intentos = await prisma.intentoAutenticacion.count({
      where: { correo: 'objetivo@prueba.edu.mx', exitoso: false },
    });

    // Redis lleva el contador que decide el bloqueo, pero expira. Esta tabla
    // es la evidencia, y la evidencia no debe expirar (SC-LAB-003 §6).
    expect(intentos).toBeGreaterThan(0);
  });

  it('7. un correo inexistente tambien deja rastro, para detectar enumeracion', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ correo: 'sonda@prueba.edu.mx', contrasena: 'loquesea12345' });

    const intento = await prisma.intentoAutenticacion.findFirst({
      where: { correo: 'sonda@prueba.edu.mx' },
    });

    expect(intento).not.toBeNull();
    expect(intento?.usuarioId).toBeNull();
  });

  // --- Prueba negativa 11 --------------------------------------------------

  it('11. la sesion se regenera en cada login (RNFS-013)', async () => {
    const primera = await iniciarSesion(app, usuario.correo);
    const segunda = await iniciarSesion(app, usuario.correo);

    expect(primera).not.toBe(segunda);
  });

  it('11. la cookie lleva HttpOnly y SameSite (RNFS-012)', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ correo: usuario.correo, contrasena: CONTRASENA });

    const cookies = respuesta.headers['set-cookie'];
    const lista = Array.isArray(cookies) ? cookies : [cookies];
    const cookie = lista.find((c) => c?.startsWith('sc_sesion='));

    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('11. se almacena el hash de la sesion, nunca el token (RNFS-011)', async () => {
    const cookie = await iniciarSesion(app, usuario.correo);
    const token = cookie.replace('sc_sesion=', '');

    const porToken = await prisma.sesion.findFirst({ where: { tokenHash: token } });
    expect(porToken).toBeNull();

    const porHash = await prisma.sesion.findFirst({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    });
    expect(porHash).not.toBeNull();
  });

  it('11. cambiar la contrasena revoca TODAS las sesiones (RNFS-014)', async () => {
    const titular = await crearUsuario(prisma, 'multi@prueba.edu.mx', 'estudiante');

    const escritorio = await iniciarSesion(app, titular.correo);
    const movil = await iniciarSesion(app, titular.correo);

    // Ambas sesiones funcionan antes del cambio.
    expect((await request(app.getHttpServer()).get('/api/auth/yo').set('Cookie', movil)).status).toBe(200);

    const cambio = await request(app.getHttpServer())
      .post('/api/auth/contrasena/cambiar')
      .set('Cookie', escritorio)
      .send({ contrasenaActual: CONTRASENA, contrasenaNueva: 'ContrasenaNueva!2026' });

    expect(cambio.status).toBe(204);

    // Es el criterio (f) de SC-LAB-003 §3, el mas caro de agregar tarde: sin
    // esto, el atacante que ya entro conserva su sesion aunque la victima
    // cambie su credencial.
    const despuesMovil = await request(app.getHttpServer()).get('/api/auth/yo').set('Cookie', movil);
    expect(despuesMovil.status).toBe(401);

    const despuesEscritorio = await request(app.getHttpServer())
      .get('/api/auth/yo')
      .set('Cookie', escritorio);
    expect(despuesEscritorio.status).toBe(401);
  }, 30_000);

  it('11. el cambio de contrasena exige la actual', async () => {
    const otro = await crearUsuario(prisma, 'exige@prueba.edu.mx', 'estudiante');
    const cookie = await iniciarSesion(app, otro.correo);

    const respuesta = await request(app.getHttpServer())
      .post('/api/auth/contrasena/cambiar')
      .set('Cookie', cookie)
      .send({ contrasenaActual: 'NoEsLaCorrecta1', contrasenaNueva: 'ContrasenaNueva!2026' });

    // Sin esto, una sesion robada bastaria para tomar la cuenta de forma
    // permanente sin conocer la credencial.
    expect(respuesta.status).toBe(401);
  });

  it('11. cerrar sesion la revoca en el servidor, no solo en el navegador', async () => {
    const otro = await crearUsuario(prisma, 'cierre@prueba.edu.mx', 'estudiante');
    const cookie = await iniciarSesion(app, otro.correo);

    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie);

    // Se reenvia la MISMA cookie: si la revocacion fuera solo del lado del
    // cliente, esta peticion seguiria funcionando.
    const despues = await request(app.getHttpServer()).get('/api/auth/yo').set('Cookie', cookie);
    expect(despues.status).toBe(401);
  });

  // --- Prueba negativa 8: RF-010 reescrito ---------------------------------

  describe('8. recuperacion de cuenta (RF-010)', () => {
    const correoRecuperacion = 'recupera@prueba.edu.mx';
    let titular: UsuarioDePrueba;

    beforeAll(async () => {
      titular = await crearUsuario(prisma, correoRecuperacion, 'estudiante');
    });

    /**
     * Emite un token real y devuelve su valor en claro.
     *
     * Admite un titular distinto del compartido porque cada token insertado
     * cuenta contra `RECUPERACION_MAX_SOLICITUDES_HORA`, que el servicio mide
     * contando filas de la ultima hora. Una prueba que necesite que
     * `solicitar` llegue a emitir de verdad tiene que partir de una cuenta con
     * el contador en cero, o el limite la cortara en silencio —que es el
     * comportamiento correcto del servicio, no un fallo suyo—.
     */
    async function emitirToken(
      opciones: { expiraEn?: number; usuario?: UsuarioDePrueba } = {},
    ): Promise<string> {
      const token = randomBytes(32).toString('base64url');
      const expiraEl = new Date(Date.now() + (opciones.expiraEn ?? 20 * 60_000));

      await prisma.tokenRecuperacion.create({
        data: {
          usuarioId: (opciones.usuario ?? titular).id,
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiraEl,
        },
      });

      return token;
    }

    it('la solicitud responde IGUAL exista o no la cuenta (RNFS-020)', async () => {
      const existente = await request(app.getHttpServer())
        .post('/api/auth/recuperacion/solicitar')
        .send({ correo: correoRecuperacion });

      const inexistente = await request(app.getHttpServer())
        .post('/api/auth/recuperacion/solicitar')
        .send({ correo: 'jamas.registrado@prueba.edu.mx' });

      expect(existente.status).toBe(inexistente.status);
      expect(existente.body).toEqual(inexistente.body);
    });

    it('se almacena solo el hash del token (RNFS-021)', async () => {
      const token = await emitirToken();

      const enClaro = await prisma.tokenRecuperacion.findFirst({ where: { tokenHash: token } });
      expect(enClaro).toBeNull();

      // Un volcado de la base no entrega enlaces validos.
      const porHash = await prisma.tokenRecuperacion.findFirst({
        where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      });
      expect(porHash).not.toBeNull();
    });

    it('un token valido completa la recuperacion una sola vez', async () => {
      const token = await emitirToken();

      const primera = await request(app.getHttpServer())
        .post('/api/auth/recuperacion/completar')
        .send({ token, contrasenaNueva: 'RecuperadaPrimera!26' });

      expect(primera.body.completado).toBe(true);

      // Reutilizar el MISMO enlace: el fallo original de RF-010.
      const segunda = await request(app.getHttpServer())
        .post('/api/auth/recuperacion/completar')
        .send({ token, contrasenaNueva: 'RecuperadaSegunda!26' });

      expect(segunda.body.completado).toBe(false);
      expect(segunda.status).toBe(primera.status);
    }, 30_000);

    it('un token vencido se rechaza (RNFS-022)', async () => {
      const token = await emitirToken({ expiraEn: -60_000 });

      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/recuperacion/completar')
        .send({ token, contrasenaNueva: 'DeberiaFallar!2026' });

      expect(respuesta.body.completado).toBe(false);
    });

    it('emitir un token nuevo invalida el anterior (RNFS-023)', async () => {
      // Cuenta propia: el contador de solicitudes por hora de `titular` ya
      // esta agotado por las pruebas anteriores, y con el agotado `solicitar`
      // no emite nada, asi que no habria invalidacion que observar.
      const correoAislado = 'recupera.aislado@prueba.edu.mx';
      const propio = await crearUsuario(prisma, correoAislado, 'estudiante');
      const anterior = await emitirToken({ usuario: propio });

      // Pasa por el flujo real, que es el que encadena la invalidacion.
      await request(app.getHttpServer())
        .post('/api/auth/recuperacion/solicitar')
        .send({ correo: correoAislado });

      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/recuperacion/completar')
        .send({ token: anterior, contrasenaNueva: 'ConTokenViejo!2026' });

      expect(respuesta.body.completado).toBe(false);
    }, 30_000);

    it('token inexistente, vencido y usado responden IDENTICO', async () => {
      const usado = await emitirToken();
      await request(app.getHttpServer())
        .post('/api/auth/recuperacion/completar')
        .send({ token: usado, contrasenaNueva: 'ParaConsumirlo!26' });

      const vencido = await emitirToken({ expiraEn: -60_000 });
      const inexistente = randomBytes(32).toString('base64url');

      const respuestas = await Promise.all(
        [usado, vencido, inexistente].map((token) =>
          request(app.getHttpServer())
            .post('/api/auth/recuperacion/completar')
            .send({ token, contrasenaNueva: 'MismaRespuesta!26' }),
        ),
      );

      const primera = respuestas[0]!;
      for (const respuesta of respuestas) {
        expect(respuesta.status).toBe(primera.status);
        expect(respuesta.body).toEqual(primera.body);
      }
    }, 30_000);

    it('el token nunca aparece en la bitacora (RNFS-024)', async () => {
      const token = await emitirToken();
      await request(app.getHttpServer())
        .post('/api/auth/recuperacion/completar')
        .send({ token, contrasenaNueva: 'SinFugaEnLog!2026' });

      const eventos = await prisma.eventoAuditoria.findMany({
        where: { accion: { in: ['recuperacion.solicitud', 'recuperacion.completada'] } },
      });

      const serializado = JSON.stringify(eventos);
      expect(serializado).not.toContain(token);
    }, 30_000);

    it('completar la recuperacion revoca todas las sesiones (RNFS-025)', async () => {
      const victima = await crearUsuario(prisma, 'victima@prueba.edu.mx', 'estudiante');
      const sesionIntrusa = await iniciarSesion(app, victima.correo);

      const token = randomBytes(32).toString('base64url');
      await prisma.tokenRecuperacion.create({
        data: {
          usuarioId: victima.id,
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiraEl: new Date(Date.now() + 20 * 60_000),
        },
      });

      await request(app.getHttpServer())
        .post('/api/auth/recuperacion/completar')
        .send({ token, contrasenaNueva: 'ExpulsaAlIntruso!26' });

      // El escenario que el criterio (f) existe para cubrir: alguien ya estaba
      // dentro, la titular recupera su cuenta y el intruso debe quedar fuera.
      const despues = await request(app.getHttpServer())
        .get('/api/auth/yo')
        .set('Cookie', sesionIntrusa);

      expect(despues.status).toBe(401);
    }, 30_000);
  });
});
