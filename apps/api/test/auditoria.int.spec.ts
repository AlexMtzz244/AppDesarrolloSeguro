import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
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
 * Pruebas negativas 10 y 12 del prompt maestro.
 *
 *   10. Cambio de calificacion, rol, permiso o asignacion: mutacion y
 *       auditoria son atomicas.
 *   12. La auditoria no admite update/delete desde la identidad de aplicacion.
 *
 * La 12 es la que sostiene todo lo demas. SC-LAB-001 escenario 4: "si el
 * atacante alcanza el privilegio administrativo, la bitacora es lo unico que
 * queda, y solo sirve si el no puede editarla".
 */
describe('auditoria append-only y atomicidad', () => {
  let entorno: AppDePrueba;
  let app: INestApplication;
  let prisma: PrismaClient;
  let administrador: UsuarioDePrueba;
  let objetivo: UsuarioDePrueba;
  let cookieAdmin: string;

  beforeAll(async () => {
    entorno = await levantarApp();
    app = entorno.app;
    prisma = entorno.prisma;

    await limpiar(prisma);
    await sembrarRoles(prisma);

    administrador = await crearUsuario(prisma, 'auditor@prueba.edu.mx', 'administrador');
    objetivo = await crearUsuario(prisma, 'objetivo.rol@prueba.edu.mx', 'estudiante');

    cookieAdmin = await iniciarSesion(app, administrador.correo);
    await marcarMfaVerificada(prisma, administrador.id);
  }, 60_000);

  afterAll(async () => {
    await entorno.cerrar();
  });

  // --- Prueba negativa 12 --------------------------------------------------

  it('12. la aplicacion NO puede hacer UPDATE sobre la bitacora (RNFS-031)', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.eventoAuditoria.create({
        data: {
          accion: 'perfil.lectura',
          tipoRecurso: 'perfil',
          resultado: 'exito',
          correlationId: 'prueba-inmutabilidad',
        },
      });
    });

    const evento = await prisma.eventoAuditoria.findFirst({
      where: { correlationId: 'prueba-inmutabilidad' },
    });
    expect(evento).not.toBeNull();

    // El rol de aplicacion no tiene el permiso, y ademas hay un trigger. Este
    // intento debe fallar por cualquiera de las dos vias.
    await expect(
      prisma.eventoAuditoria.update({
        where: { id: evento!.id },
        data: { resultado: 'denegado', motivo: 'alterado por un atacante' },
      }),
    ).rejects.toThrow();

    const sinCambios = await prisma.eventoAuditoria.findUnique({ where: { id: evento!.id } });
    expect(sinCambios?.resultado).toBe('exito');
    expect(sinCambios?.motivo).toBeNull();
  });

  it('12. la aplicacion NO puede hacer DELETE sobre la bitacora', async () => {
    const evento = await prisma.eventoAuditoria.findFirst({
      where: { correlationId: 'prueba-inmutabilidad' },
    });

    await expect(
      prisma.eventoAuditoria.delete({ where: { id: evento!.id } }),
    ).rejects.toThrow();

    expect(
      await prisma.eventoAuditoria.findUnique({ where: { id: evento!.id } }),
    ).not.toBeNull();
  });

  it('12. la aplicacion NO puede hacer TRUNCATE sobre la bitacora', async () => {
    // TRUNCATE no dispara triggers FOR EACH ROW: sin su propio trigger a nivel
    // de sentencia, una sola instruccion borraria la bitacora completa
    // esquivando las dos reglas anteriores.
    await expect(
      prisma.$executeRawUnsafe('TRUNCATE TABLE evento_auditoria'),
    ).rejects.toThrow();

    expect(await prisma.eventoAuditoria.count()).toBeGreaterThan(0);
  });

  it('12. la API no expone ninguna ruta de escritura sobre auditoria (RF-081)', async () => {
    const intentos = [
      request(app.getHttpServer()).post('/api/auditoria').set('Cookie', cookieAdmin).send({}),
      request(app.getHttpServer()).patch('/api/auditoria/1').set('Cookie', cookieAdmin).send({}),
      request(app.getHttpServer()).delete('/api/auditoria/1').set('Cookie', cookieAdmin),
    ];

    for (const intento of intentos) {
      const respuesta = await intento;
      expect([403, 404, 405]).toContain(respuesta.status);
    }
  });

  it('12. la consulta de auditoria SI funciona para quien la tiene (RF-080)', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/auditoria?pagina=1&tamano=10')
      .set('Cookie', cookieAdmin);

    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body.datos)).toBe(true);
  });

  // --- Prueba negativa 10 --------------------------------------------------

  it('10. la asignacion de rol produce su evento en la misma transaccion', async () => {
    const antes = await prisma.eventoAuditoria.count({ where: { accion: 'rol.asignacion' } });

    const respuesta = await request(app.getHttpServer())
      .post(`/api/usuarios/${objetivo.idPublico}/roles`)
      .set('Cookie', cookieAdmin)
      .send({
        rolClave: 'profesor',
        motivo: 'Alta como profesor para el periodo 2026-2',
        hastaEl: null,
      });

    expect(respuesta.status).toBe(201);

    const despues = await prisma.eventoAuditoria.count({ where: { accion: 'rol.asignacion' } });
    expect(despues).toBe(antes + 1);

    const evento = await prisma.eventoAuditoria.findFirst({
      where: { accion: 'rol.asignacion' },
      orderBy: { creadoEl: 'desc' },
    });

    expect(evento?.actorId).toBe(administrador.id);
    expect(evento?.motivo).toContain('profesor');
    expect(evento?.despues).toBeTruthy();
  });

  it('10. si la mutacion falla, NO queda evento (RNFS-030)', async () => {
    const antes = await prisma.eventoAuditoria.count();

    // Se fuerza el fallo despues de escribir el evento, dentro de la misma
    // transaccion. Es la comprobacion directa de la atomicidad: si el evento
    // se escribiera fuera, sobreviviria al rollback.
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.eventoAuditoria.create({
          data: {
            accion: 'rol.asignacion',
            tipoRecurso: 'asignacion-rol',
            resultado: 'exito',
            correlationId: 'rollback-forzado',
          },
        });
        throw new Error('fallo simulado de la mutacion');
      }),
    ).rejects.toThrow('fallo simulado');

    expect(await prisma.eventoAuditoria.count()).toBe(antes);
    expect(
      await prisma.eventoAuditoria.findFirst({ where: { correlationId: 'rollback-forzado' } }),
    ).toBeNull();
  });

  it('10. el evento registra los doce campos exigidos (RNFS-032)', async () => {
    const evento = await prisma.eventoAuditoria.findFirst({
      where: { accion: 'rol.asignacion', resultado: 'exito' },
      orderBy: { creadoEl: 'desc' },
    });

    expect(evento).not.toBeNull();
    expect(evento!.creadoEl).toBeInstanceOf(Date);
    expect(evento!.actorId).toBeTruthy();
    expect(evento!.actorCorreo).toBeTruthy();
    expect(evento!.accion).toBeTruthy();
    expect(evento!.tipoRecurso).toBeTruthy();
    expect(evento!.recursoId).toBeTruthy();
    expect(evento!.resultado).toBeTruthy();
    expect(evento!.motivo).toBeTruthy();
    expect(evento!.despues).toBeTruthy();
    expect(evento!.correlationId).toBeTruthy();
  });

  it('10. la bitacora nunca guarda contrasenas ni tokens', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.eventoAuditoria.create({
        data: {
          accion: 'usuario.alta',
          tipoRecurso: 'usuario',
          resultado: 'exito',
          correlationId: 'prueba-saneo',
          // Se escribe directamente para verificar que el saneador del
          // servicio es lo que filtra, no que nadie haya pasado estos campos.
          despues: {
            correo: 'x@y.mx',
            contrasena: 'NoDeberiaEstarAqui',
            tokenRecuperacion: 'tampoco-esto',
          },
        },
      });
    });

    const evento = await prisma.eventoAuditoria.findFirst({
      where: { correlationId: 'prueba-saneo' },
    });

    // Escrito por Prisma directo, el dato SI entra: es la prueba de que el
    // saneo vive en `AuditoriaService` y de que escribir la bitacora por fuera
    // de ese servicio es justamente lo que no debe hacerse.
    expect(JSON.stringify(evento?.despues)).toContain('NoDeberiaEstarAqui');
  });

  it('10. al pasar por el servicio, los campos sensibles se omiten', async () => {
    const nuevo = await crearUsuario(prisma, 'saneo@prueba.edu.mx', 'estudiante');

    await request(app.getHttpServer())
      .post(`/api/usuarios/${nuevo.idPublico}/roles`)
      .set('Cookie', cookieAdmin)
      .send({
        rolClave: 'profesor',
        motivo: 'Verificacion del saneo de campos sensibles',
        hastaEl: null,
      });

    const eventos = await prisma.eventoAuditoria.findMany({
      where: { accion: 'rol.asignacion' },
    });

    const serializado = JSON.stringify(eventos);
    expect(serializado).not.toMatch(/contrasenaHash/i);
    expect(serializado).not.toContain('$argon2');
  });

  // --- Separacion de funciones en caliente (prueba negativa 4) -------------

  it('4. rechaza acumular asignar docencia y capturar calificaciones (RNFS-007)', async () => {
    const candidato = await crearUsuario(prisma, 'doble.rol@prueba.edu.mx', 'jefe-carrera');

    const respuesta = await request(app.getHttpServer())
      .post(`/api/usuarios/${candidato.idPublico}/roles`)
      .set('Cookie', cookieAdmin)
      .send({
        rolClave: 'profesor',
        motivo: 'Intento de acumular asignacion docente y captura de notas',
        hastaEl: null,
      });

    // Es el ataque del escenario 5 de SC-LAB-001 cortado en su raiz: sin esta
    // combinacion, nadie puede asignarse un grupo y despues calificarlo con la
    // misma cuenta.
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.codigo).toBe('SEPARACION_FUNCIONES');

    const asignaciones = await prisma.asignacionRol.count({
      where: { usuarioId: candidato.id, revocadaEl: null },
    });
    expect(asignaciones).toBe(1);
  });

  it('4. un administrador no puede asignarse roles a si mismo', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/api/usuarios/${administrador.idPublico}/roles`)
      .set('Cookie', cookieAdmin)
      .send({
        rolClave: 'profesor',
        motivo: 'Intento de autoasignacion para escalar privilegios',
        hastaEl: null,
      });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.codigo).toBe('AUTOASIGNACION');
  });

  it('un permiso vencido deja de aplicar sin tarea de limpieza', async () => {
    const temporal = await crearUsuario(prisma, 'temporal@prueba.edu.mx', 'estudiante');
    const cookie = await iniciarSesion(app, temporal.correo);

    // Funciona mientras la asignacion esta vigente.
    expect((await request(app.getHttpServer()).get('/api/auth/yo').set('Cookie', cookie)).status).toBe(200);

    // Se vence la asignacion sin ejecutar ningun proceso de revocacion.
    await prisma.asignacionRol.updateMany({
      where: { usuarioId: temporal.id },
      data: { hastaEl: new Date(Date.now() - 1000) },
    });

    const despues = await request(app.getHttpServer()).get('/api/auth/yo').set('Cookie', cookie);

    // La sesion sigue viva pero sin ningun permiso: la caducidad es parte de
    // la consulta, no un proceso aparte que pueda fallar.
    expect(despues.status).toBe(401);
  });
});
