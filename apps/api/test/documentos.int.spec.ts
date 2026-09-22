import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
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
 * Prueba negativa 9 del prompt maestro.
 *
 *   9. Archivo ejecutable renombrado, excesivo, cuota agotada o URL directa
 *      del objeto: rechazo o inaccesible.
 *
 * Es el escenario 2 de SC-LAB-001, y SC-LAB-003 §5 lo analiza como el mas caro
 * de corregir tarde porque es el unico que acumula datos reales: "en
 * requisitos el control es gratuito porque el almacen esta vacio; en
 * produccion se convierte en un proyecto de migracion".
 */

/** PDF minimo valido: empieza con los magic bytes `%PDF-`. */
const PDF_VALIDO = Buffer.concat([
  Buffer.from('%PDF-1.4\n'),
  Buffer.from('1 0 obj<</Type/Catalog>>endobj\n'),
  Buffer.from('trailer<</Root 1 0 R>>\n%%EOF\n'),
]);

/**
 * Ejecutable de Windows renombrado a `.pdf`.
 *
 * `MZ` son los magic bytes de un PE. La extension y el Content-Type dicen PDF;
 * el contenido dice otra cosa. Es el ataque literal del escenario 2.
 */
const EJECUTABLE_DISFRAZADO = Buffer.concat([
  Buffer.from('MZ'),
  Buffer.alloc(64, 0),
  Buffer.from('This program cannot be run in DOS mode'),
  Buffer.alloc(512, 0x41),
]);

describe('documentos: entrega privada, tipo real y cuota', () => {
  let entorno: AppDePrueba;
  let app: INestApplication;
  let prisma: PrismaClient;
  let titular: UsuarioDePrueba;
  let ajeno: UsuarioDePrueba;
  let cookieTitular: string;
  let cookieAjeno: string;

  beforeAll(async () => {
    entorno = await levantarApp();
    app = entorno.app;
    prisma = entorno.prisma;

    await limpiar(prisma);
    await sembrarRoles(prisma);

    await prisma.tipoDocumento.create({
      data: {
        idPublico: ulid(),
        clave: 'constancia',
        nombre: 'Constancia de estudios',
        mimesPermitidos: 'application/pdf',
        tamanoMaximoBytes: BigInt(1024 * 1024),
      },
    });

    titular = await crearUsuario(prisma, 'titular.doc@prueba.edu.mx', 'estudiante');
    ajeno = await crearUsuario(prisma, 'ajeno.doc@prueba.edu.mx', 'estudiante');

    cookieTitular = await iniciarSesion(app, titular.correo);
    cookieAjeno = await iniciarSesion(app, ajeno.correo);
  }, 60_000);

  afterAll(async () => {
    await entorno.cerrar();
  });

  it('9. rechaza un ejecutable renombrado a .pdf (RNFS-044)', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/api/documentos?tipo=constancia')
      .set('Cookie', cookieTitular)
      // El navegador DECLARA que es un PDF. El servidor mira los magic bytes.
      .attach('archivo', EJECUTABLE_DISFRAZADO, {
        filename: 'constancia.pdf',
        contentType: 'application/pdf',
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.codigo).toBe('TIPO_NO_PERMITIDO');

    expect(await prisma.documento.count({ where: { titularId: titular.id } })).toBe(0);
  }, 30_000);

  it('9. el rechazo por tipo queda auditado', async () => {
    const evento = await prisma.eventoAuditoria.findFirst({
      where: { accion: 'documento.carga', resultado: 'denegado' },
      orderBy: { creadoEl: 'desc' },
    });

    expect(evento).not.toBeNull();
    expect(evento?.motivo).toMatch(/tipo-no-permitido|contenido-no-coincide/);
  });

  it('9. rechaza un archivo que excede el tamano maximo (RNFS-045)', async () => {
    const enorme = Buffer.concat([PDF_VALIDO, Buffer.alloc(2 * 1024 * 1024, 0x20)]);

    const respuesta = await request(app.getHttpServer())
      .post('/api/documentos?tipo=constancia')
      .set('Cookie', cookieTitular)
      .attach('archivo', enorme, { filename: 'grande.pdf', contentType: 'application/pdf' });

    expect(respuesta.status).toBe(413);
    expect(respuesta.body.codigo).toBe('EXCEDE_TAMANO_MAXIMO');
  }, 30_000);

  it('9. rechaza cuando la cuota esta agotada (RNFS-045)', async () => {
    await prisma.cuotaUsuario.update({
      where: { usuarioId: titular.id },
      data: { usadoBytes: BigInt(10 * 1024 * 1024), limiteBytes: BigInt(10 * 1024 * 1024) },
    });

    const respuesta = await request(app.getHttpServer())
      .post('/api/documentos?tipo=constancia')
      .set('Cookie', cookieTitular)
      .attach('archivo', PDF_VALIDO, { filename: 'ok.pdf', contentType: 'application/pdf' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.codigo).toBe('CUOTA_AGOTADA');

    await prisma.cuotaUsuario.update({
      where: { usuarioId: titular.id },
      data: { usadoBytes: 0n, limiteBytes: BigInt(10 * 1024 * 1024) },
    });
  }, 30_000);

  it('9. el documento de otro usuario responde 403 (RNFS-042)', async () => {
    // Se inserta directamente para no depender de MinIO ni de ClamAV: lo que
    // se verifica aqui es la autorizacion, no el almacenamiento.
    const tipo = await prisma.tipoDocumento.findFirstOrThrow({ where: { clave: 'constancia' } });
    const documento = await prisma.documento.create({
      data: {
        idPublico: ulid(),
        titularId: titular.id,
        subidoPorId: titular.id,
        tipoDocumentoId: tipo.id,
        nombreOriginal: 'constancia.pdf',
        claveObjeto: `2026/09/${'a'.repeat(64)}`,
        bucket: 'securecampus-documentos',
        tipoMimeReal: 'application/pdf',
        tamanoBytes: BigInt(PDF_VALIDO.byteLength),
        sha256: 'b'.repeat(64),
        estadoAntivirus: 'limpio',
      },
      select: { idPublico: true },
    });

    const respuesta = await request(app.getHttpServer())
      .get(`/api/documentos/${documento.idPublico}/descargar`)
      .set('Cookie', cookieAjeno);

    expect(respuesta.status).toBe(403);

    // La denegacion queda registrada con solicitante y resultado (RF-055).
    const evento = await prisma.eventoAuditoria.findFirst({
      where: { actorId: ajeno.id, resultado: 'denegado' },
      orderBy: { creadoEl: 'desc' },
    });
    expect(evento).not.toBeNull();
  });

  it('9. un documento inexistente responde IGUAL que uno ajeno (RNFS-006)', async () => {
    const ajenoReal = await prisma.documento.findFirstOrThrow({ select: { idPublico: true } });

    const respuestaAjeno = await request(app.getHttpServer())
      .get(`/api/documentos/${ajenoReal.idPublico}/descargar`)
      .set('Cookie', cookieAjeno);

    const respuestaInexistente = await request(app.getHttpServer())
      .get('/api/documentos/01ARZ3NDEKTSV4RRFFQ69G5FAV/descargar')
      .set('Cookie', cookieAjeno);

    expect(respuestaInexistente.status).toBe(respuestaAjeno.status);
    expect(respuestaInexistente.body.codigo).toBe(respuestaAjeno.body.codigo);
  });

  it('9. un documento en cuarentena no se entrega ni a su titular (RNFS-046)', async () => {
    const tipo = await prisma.tipoDocumento.findFirstOrThrow({ where: { clave: 'constancia' } });
    const retenido = await prisma.documento.create({
      data: {
        idPublico: ulid(),
        titularId: titular.id,
        subidoPorId: titular.id,
        tipoDocumentoId: tipo.id,
        nombreOriginal: 'sospechoso.pdf',
        claveObjeto: `2026/09/${'c'.repeat(64)}`,
        bucket: 'securecampus-cuarentena',
        tipoMimeReal: 'application/pdf',
        tamanoBytes: 1024n,
        sha256: 'd'.repeat(64),
        estadoAntivirus: 'en-cuarentena',
      },
      select: { idPublico: true },
    });

    const respuesta = await request(app.getHttpServer())
      .get(`/api/documentos/${retenido.idPublico}/descargar`)
      .set('Cookie', cookieTitular);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.codigo).toBe('DOCUMENTO_NO_DISPONIBLE');
  });

  it('9. un fallo del antivirus NO cuenta como limpio', async () => {
    const tipo = await prisma.tipoDocumento.findFirstOrThrow({ where: { clave: 'constancia' } });
    const conError = await prisma.documento.create({
      data: {
        idPublico: ulid(),
        titularId: titular.id,
        subidoPorId: titular.id,
        tipoDocumentoId: tipo.id,
        nombreOriginal: 'sin-analizar.pdf',
        claveObjeto: `2026/09/${'e'.repeat(64)}`,
        bucket: 'securecampus-cuarentena',
        tipoMimeReal: 'application/pdf',
        tamanoBytes: 1024n,
        sha256: 'f'.repeat(64),
        estadoAntivirus: 'error-analisis',
      },
      select: { idPublico: true },
    });

    // Tratar el fallo como "limpio" convertiria una caida del servicio de
    // analisis en una via para colar cualquier archivo. Deny by default
    // aplicado al contenido.
    const respuesta = await request(app.getHttpServer())
      .get(`/api/documentos/${conError.idPublico}/descargar`)
      .set('Cookie', cookieTitular);

    expect(respuesta.status).toBe(409);
  });

  it('9. el listado nunca expone la clave de objeto ni el bucket (RNFS-040)', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/documentos/mios')
      .set('Cookie', cookieTitular);

    expect(respuesta.status).toBe(200);

    const serializado = JSON.stringify(respuesta.body);
    expect(serializado).not.toContain('claveObjeto');
    expect(serializado).not.toContain('bucket');
    expect(serializado).not.toContain('securecampus-documentos');
  });

  it('9. la clave de objeto no se puede deducir de la matricula (RNFS-041)', async () => {
    const documentos = await prisma.documento.findMany({
      select: { claveObjeto: true, titular: { select: { perfil: { select: { matricula: true } } } } },
    });

    for (const documento of documentos) {
      const matricula = documento.titular.perfil?.matricula;
      if (matricula) {
        // El fallo del escenario 2 era `/uploads/constancia_2026_125.pdf`.
        expect(documento.claveObjeto).not.toContain(matricula);
      }
      expect(documento.claveObjeto).not.toContain('constancia');
      // 64 caracteres hexadecimales de aleatoriedad real.
      expect(documento.claveObjeto).toMatch(/\/[0-9a-f]{64}$/);
    }
  });

  it('el titular no sube documentos a nombre de otro', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`/api/documentos?tipo=constancia&titular=${ajeno.idPublico}`)
      .set('Cookie', cookieTitular)
      .attach('archivo', PDF_VALIDO, { filename: 'ok.pdf', contentType: 'application/pdf' });

    // Sin esta comprobacion, cualquiera podria inyectar documentos en el
    // expediente ajeno.
    expect(respuesta.status).toBe(403);
  }, 30_000);
});
