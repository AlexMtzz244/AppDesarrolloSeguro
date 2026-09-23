import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ulid } from 'ulid';
import { hash } from '@node-rs/argon2';
import { MATRIZ_ROL_PERMISOS, PERMISOS, ROLES_BASE, type RolBase } from '@securecampus/contracts';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/comun/prisma.service.js';
import { middlewareCorrelacion } from '../src/comun/correlacion.js';
import { FiltroExcepciones } from '../src/comun/excepciones.filter.js';

/**
 * Andamiaje de las pruebas de integracion.
 *
 * Levanta la aplicacion REAL, con su guard global, su filtro de excepciones y
 * su base de datos. Nada se sustituye por un doble: las pruebas negativas de
 * autorizacion pierden todo su valor si el guard esta simulado, porque lo que
 * se quiere comprobar es precisamente que el guard de produccion rechaza lo
 * que debe rechazar.
 */

export const CONTRASENA = 'PruebaIntegracion!2026';

export interface AppDePrueba {
  readonly app: INestApplication;
  readonly prisma: PrismaClient;
  cerrar(): Promise<void>;
}

export async function levantarApp(): Promise<AppDePrueba> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = modulo.createNestApplication();
  app.use(cookieParser());
  app.use(middlewareCorrelacion(0));
  app.useGlobalFilters(new FiltroExcepciones(false));
  app.setGlobalPrefix('api');
  await app.init();

  // El token registrado en ComunModule es `PrismaService`, no `PrismaClient`:
  // pedir la clase base no encuentra proveedor alguno. `PrismaService` la
  // extiende, asi que las pruebas siguen viendo un `PrismaClient` completo.
  const prisma = app.get(PrismaService) as PrismaClient;

  return {
    app,
    prisma,
    async cerrar() {
      await app.close();
    },
  };
}

/**
 * Limpia la base respetando el orden de las claves foraneas.
 *
 * TODO el TRUNCATE corre con el rol PROPIETARIO, no con el de la aplicacion.
 * El rol de aplicacion recibe unicamente SELECT, INSERT, UPDATE y DELETE
 * (`infra/postgres/init/01-rol-aplicacion.sh`), y TRUNCATE es un privilegio
 * aparte que nunca se le concede. No es una carencia que haya que rodear: es
 * el privilegio minimo de RNFS-031 funcionando, y por eso la limpieza usa la
 * credencial que si tiene esa facultad en vez de ampliar la que no.
 *
 * `evento_auditoria` va en una sentencia separada porque sobre ella el REVOKE
 * de la migracion 2 es todavia mas estricto.
 */
export async function limpiar(_prisma: PrismaClient): Promise<void> {
  const urlPropietario = process.env['DATABASE_URL_MIGRACIONES'];
  if (!urlPropietario) {
    throw new Error(
      'DATABASE_URL_MIGRACIONES es obligatoria para las pruebas de ' +
        'integracion: la limpieza exige el rol propietario, porque el rol de ' +
        'la aplicacion no tiene TRUNCATE sobre ninguna tabla (RNFS-031).',
    );
  }

  // El limitador de intentos vive en Redis, no en Postgres. Sin limpiarlo, el
  // limite por IP (LOGIN_MAX_INTENTOS_IP) se agota con los inicios de sesion
  // de los archivos anteriores y las pruebas siguientes reciben 429 por
  // acumulacion, no por lo que prueban. Ese fallo es peor que un rojo honesto,
  // porque depende del orden de ejecucion.
  //
  // Se borran SOLO las claves de la aplicacion, nunca con `flushdb`: bajo el
  // prefijo `sc:` viven tambien las estructuras de BullMQ, y vaciarlas debajo
  // de un worker conectado lo deja reintentando contra una cola que ya no
  // existe. El worker del servidor de desarrollo, si esta levantado, comparte
  // este mismo Redis.
  const urlRedis = process.env['REDIS_URL'];
  if (urlRedis) {
    const redis = new Redis(urlRedis);
    try {
      for (const patron of ['sc:intentos:*', 'sc:desafio-mfa:*']) {
        const claves = await redis.keys(patron);
        if (claves.length > 0) await redis.del(...claves);
      }
    } finally {
      redis.disconnect();
    }
  }

  const propietario = new PrismaClient({ datasources: { db: { url: urlPropietario } } });
  try {
    await propietario.$executeRawUnsafe(`
      TRUNCATE TABLE
        version_calificacion, calificacion,
        solicitud_adjunto, historial_solicitud, solicitud, estado_solicitud, tipo_solicitud,
        documento, tipo_documento, cuota_usuario,
        asignacion_docente, inscripcion, bloque_horario, grupo,
        autorizacion_extraordinaria, periodo, materia, aula, programa,
        alerta, notificacion, intento_autenticacion,
        token_recuperacion, codigo_recuperacion_mfa, credencial_totp, sesion,
        asignacion_rol, rol_permiso, permiso, rol,
        perfil, usuario,
        parametro_configuracion
      RESTART IDENTITY CASCADE
    `);
    // `evento_auditoria` no la puede vaciar NADIE mientras el trigger de la
    // migracion 2 este activo, ni siquiera el propietario: esa es justamente
    // la capa (b) del control, la que cubre el caso de que alguien ejecute
    // sentencias con la credencial propietaria.
    //
    // La unica forma legitima de limpiarla entre pruebas es desactivar el
    // trigger, vaciar y volverlo a activar, con la credencial que la migracion
    // reconoce como propietaria. Se hace en `try/finally` porque dejarlo
    // desactivado convertiria la prueba negativa 12 en un verde vacio: seguiria
    // pasando sin que el control existiera.
    try {
      await propietario.$executeRawUnsafe(
        'ALTER TABLE evento_auditoria DISABLE TRIGGER evento_auditoria_sin_truncate',
      );
      await propietario.$executeRawUnsafe('TRUNCATE TABLE evento_auditoria CASCADE');
    } finally {
      await propietario.$executeRawUnsafe(
        'ALTER TABLE evento_auditoria ENABLE TRIGGER evento_auditoria_sin_truncate',
      );
    }
  } finally {
    await propietario.$disconnect();
  }
}

/** Siembra permisos y roles con la matriz real del sistema. */
export async function sembrarRoles(prisma: PrismaClient): Promise<void> {
  for (const clave of PERMISOS) {
    const [recurso = '', operacion = ''] = clave.split(':');
    await prisma.permiso.upsert({
      where: { clave },
      create: { clave, recurso, operacion, descripcion: clave },
      update: {},
    });
  }

  for (const clave of ROLES_BASE) {
    const rol = await prisma.rol.upsert({
      where: { clave },
      create: { clave, nombre: clave, descripcion: clave, esSistema: true },
      update: {},
      select: { id: true },
    });

    const permisos = await prisma.permiso.findMany({
      where: { clave: { in: [...MATRIZ_ROL_PERMISOS[clave]] as string[] } },
      select: { id: true },
    });

    await prisma.rolPermiso.createMany({
      data: permisos.map((p) => ({ rolId: rol.id, permisoId: p.id })),
      skipDuplicates: true,
    });
  }
}

export interface UsuarioDePrueba {
  readonly id: string;
  readonly idPublico: string;
  readonly correo: string;
}

export async function crearUsuario(
  prisma: PrismaClient,
  correo: string,
  rol: RolBase,
  opciones: { programaId?: string; matricula?: string } = {},
): Promise<UsuarioDePrueba> {
  const contrasenaHash = await hash(CONTRASENA);
  const rolRegistro = await prisma.rol.findUniqueOrThrow({
    where: { clave: rol },
    select: { id: true },
  });

  const usuario = await prisma.usuario.create({
    data: {
      idPublico: ulid(),
      correo,
      contrasenaHash,
      perfil: {
        create: {
          nombre: correo.split('@')[0] ?? 'Prueba',
          apellidoPaterno: 'Prueba',
          matricula: opciones.matricula ?? null,
          programaId: opciones.programaId ?? null,
        },
      },
    },
    select: { id: true, idPublico: true, correo: true },
  });

  await prisma.asignacionRol.create({
    data: {
      idPublico: ulid(),
      usuarioId: usuario.id,
      rolId: rolRegistro.id,
      desdeEl: new Date(Date.now() - 60_000),
      motivo: 'Cuenta creada para pruebas de integracion',
      autorId: usuario.id,
    },
  });

  await prisma.cuotaUsuario.create({
    data: { usuarioId: usuario.id, usadoBytes: 0n, limiteBytes: BigInt(10 * 1024 * 1024) },
  });

  return usuario;
}

/**
 * Inicia sesion por el endpoint REAL y devuelve la cookie.
 *
 * No se fabrica la sesion insertandola en la base: eso saltaria el flujo que
 * las pruebas negativas 7 y 11 tienen que ejercitar. La cookie sale del mismo
 * camino que recorreria un navegador.
 */
export async function iniciarSesion(
  app: INestApplication,
  correo: string,
  contrasena = CONTRASENA,
): Promise<string> {
  const respuesta = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ correo, contrasena });

  const cookies = respuesta.headers['set-cookie'];
  const lista = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  const cookie = lista.find((c) => c.startsWith('sc_sesion='));

  if (!cookie) {
    throw new Error(
      `No se obtuvo cookie de sesion para ${correo}. Respuesta: ${respuesta.status} ${JSON.stringify(respuesta.body)}`,
    );
  }

  return cookie.split(';')[0] ?? '';
}

/** Marca la sesion como verificada por MFA, para probar rutas que lo exigen. */
export async function marcarMfaVerificada(prisma: PrismaClient, usuarioId: string): Promise<void> {
  await prisma.sesion.updateMany({
    where: { usuarioId, revocadaEl: null },
    data: { mfaVerificada: true },
  });
}
