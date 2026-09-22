import { createHash } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { fileTypeFromBuffer } from 'file-type';
import { ulid } from 'ulid';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { AccesoDenegado, ErrorNegocio } from '../comun/excepciones.filter.js';
import { PrismaService } from '../comun/prisma.service.js';
import { AlmacenamientoService } from './almacenamiento.service.js';
import { AntivirusService } from './antivirus.service.js';

export interface ArchivoEntrante {
  readonly buffer: Buffer;
  readonly nombreOriginal: string;
  /** Lo que DECLARA el navegador. Se ignora para decidir (RNFS-044). */
  readonly mimeDeclarado: string;
}

@Injectable()
export class DocumentosService {
  private readonly logger = new Logger(DocumentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly antivirus: AntivirusService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async misDocumentos(actor: Actor) {
    const documentos = await this.prisma.documento.findMany({
      where: { titularId: actor.usuarioId, eliminadoEl: null },
      orderBy: { subidoEl: 'desc' },
      select: {
        idPublico: true,
        nombreOriginal: true,
        tipoMimeReal: true,
        tamanoBytes: true,
        estadoAntivirus: true,
        subidoEl: true,
        tipoDocumento: { select: { clave: true, nombre: true } },
      },
    });

    return documentos.map((d) => ({
      id: d.idPublico,
      nombreOriginal: d.nombreOriginal,
      tipoMimeReal: d.tipoMimeReal,
      tamanoBytes: Number(d.tamanoBytes),
      estadoAntivirus: d.estadoAntivirus,
      subidoEl: d.subidoEl.toISOString(),
      tipoDocumento: d.tipoDocumento,
      // Nunca se expone `claveObjeto` ni `bucket`: el cliente no debe conocer
      // ni poder construir la ruta del objeto (RNFS-040).
    }));
  }

  async cuota(usuarioId: string) {
    const cuota = await this.prisma.cuotaUsuario.findUnique({ where: { usuarioId } });
    if (!cuota) return null;
    return {
      usadoBytes: Number(cuota.usadoBytes),
      limiteBytes: Number(cuota.limiteBytes),
      disponibleBytes: Number(cuota.limiteBytes - cuota.usadoBytes),
    };
  }

  /**
   * Recibe un documento (RF-050).
   *
   * El orden de las comprobaciones es deliberado: primero lo barato (tamano,
   * catalogo), despues lo caro (magic bytes, antivirus). Un archivo
   * sobredimensionado se rechaza antes de que nos cueste analizarlo.
   */
  async recibir(
    actor: Actor,
    archivo: ArchivoEntrante,
    tipoDocumentoClave: string,
    titularIdPublico?: string,
  ) {
    const tipoDocumento = await this.prisma.tipoDocumento.findUnique({
      where: { clave: tipoDocumentoClave },
      select: {
        id: true,
        clave: true,
        mimesPermitidos: true,
        tamanoMaximoBytes: true,
        activo: true,
      },
    });

    if (!tipoDocumento?.activo) {
      throw new ErrorNegocio(
        'TIPO_DOCUMENTO_DESCONOCIDO',
        'El tipo de documento no existe o no esta habilitado.',
      );
    }

    // El titular por omision es el propio actor. Subir a nombre de otro exige
    // permiso administrativo: sin esta comprobacion, cualquiera podria
    // inyectar documentos en el expediente ajeno.
    let titularId = actor.usuarioId;
    if (titularIdPublico && titularIdPublico !== actor.idPublico) {
      if (!actor.permisos.has('usuario:modificar')) throw new AccesoDenegado();
      const titular = await this.prisma.usuario.findUnique({
        where: { idPublico: titularIdPublico },
        select: { id: true },
      });
      if (!titular) throw new AccesoDenegado();
      titularId = titular.id;
    }

    // --- Tamano maximo (RNFS-045) ---
    const tamano = BigInt(archivo.buffer.byteLength);
    if (tamano > tipoDocumento.tamanoMaximoBytes) {
      await this.auditarRechazo(actor, 'excede-tamano-maximo', tipoDocumento.clave);
      throw new ErrorNegocio(
        'EXCEDE_TAMANO_MAXIMO',
        'El archivo excede el tamano maximo permitido para este tipo de documento.',
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    // --- Cuota por usuario (RNFS-045) ---
    const cuota = await this.prisma.cuotaUsuario.findUnique({ where: { usuarioId: titularId } });
    if (cuota && cuota.usadoBytes + tamano > cuota.limiteBytes) {
      await this.auditarRechazo(actor, 'cuota-agotada', tipoDocumento.clave);
      throw new ErrorNegocio(
        'CUOTA_AGOTADA',
        'No hay espacio disponible en tu cuota de almacenamiento.',
        HttpStatus.CONFLICT,
      );
    }

    // --- Tipo REAL por magic bytes (RNFS-044) ---
    //
    // La extension y el `Content-Type` los controla quien sube el archivo.
    // Confiar en ellos es el mismo error que confiar en el identificador de la
    // URL: un dato del atacante usado como control.
    const detectado = await fileTypeFromBuffer(archivo.buffer);
    const permitidos = tipoDocumento.mimesPermitidos.split(',').map((m) => m.trim());

    if (!detectado || !permitidos.includes(detectado.mime)) {
      await this.auditarRechazo(
        actor,
        detectado ? 'tipo-no-permitido' : 'contenido-no-coincide-con-extension',
        tipoDocumento.clave,
      );
      throw new ErrorNegocio(
        'TIPO_NO_PERMITIDO',
        'El contenido del archivo no corresponde a un tipo permitido.',
      );
    }

    // Se comprueba ademas que lo declarado coincida con lo real. No es lo que
    // decide —ya decidio el magic byte— pero una discrepancia es senal de que
    // alguien renombro el archivo a proposito, y eso merece quedar registrado.
    const discrepancia = archivo.mimeDeclarado !== detectado.mime;

    // --- Cuarentena (RNFS-046) ---
    const claveObjeto = this.almacenamiento.generarClave();
    const sha256 = createHash('sha256').update(archivo.buffer).digest('hex');

    await this.almacenamiento.guardar(
      this.almacenamiento.bucketCuarentena,
      claveObjeto,
      archivo.buffer,
      detectado.mime,
    );

    const documento = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.documento.create({
        data: {
          idPublico: ulid(),
          titularId,
          subidoPorId: actor.usuarioId,
          tipoDocumentoId: tipoDocumento.id,
          nombreOriginal: archivo.nombreOriginal.slice(0, 255),
          claveObjeto,
          bucket: this.almacenamiento.bucketCuarentena,
          tipoMimeReal: detectado.mime,
          tamanoBytes: tamano,
          sha256,
          estadoAntivirus: 'en-cuarentena',
        },
        select: { id: true, idPublico: true },
      });

      await tx.cuotaUsuario.upsert({
        where: { usuarioId: titularId },
        create: { usuarioId: titularId, usadoBytes: tamano, limiteBytes: tamano * 100n },
        update: { usadoBytes: { increment: tamano } },
      });

      await this.auditoria.registrar(tx, {
        accion: 'documento.carga',
        tipoRecurso: 'documento',
        recursoId: creado.idPublico,
        resultado: 'exito',
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        despues: {
          tipoDocumento: tipoDocumento.clave,
          tipoMimeReal: detectado.mime,
          tipoMimeDeclarado: archivo.mimeDeclarado,
          discrepanciaDeTipo: discrepancia,
          tamanoBytes: Number(tamano),
          sha256,
        },
      });

      return creado;
    });

    // El analisis corre despues de responder. El documento queda en cuarentena
    // y no es descargable hasta que el antivirus se pronuncie.
    void this.analizar(documento.id).catch((error) =>
      this.logger.error({ error, documentoId: documento.id }, 'Fallo el analisis antivirus'),
    );

    return {
      id: documento.idPublico,
      estadoAntivirus: 'en-cuarentena',
      mensaje: 'El documento se esta analizando y estara disponible en unos momentos.',
    };
  }

  /**
   * Analiza el documento y, si esta limpio, lo mueve al bucket definitivo.
   *
   * `error-analisis` NO cuenta como limpio. Si el antivirus no pudo
   * pronunciarse, el archivo se queda retenido: el valor por defecto seguro es
   * negar. Es *deny by default* aplicado al contenido.
   */
  async analizar(documentoId: string): Promise<void> {
    const documento = await this.prisma.documento.findUnique({
      where: { id: documentoId },
      select: { id: true, idPublico: true, claveObjeto: true, bucket: true, tipoMimeReal: true },
    });

    if (!documento) return;

    const flujo = await this.almacenamiento.obtener(documento.bucket, documento.claveObjeto);
    const veredicto = await this.antivirus.analizar(flujo);

    if (veredicto.limpio) {
      const claveDefinitiva = this.almacenamiento.generarClave();
      await this.almacenamiento.mover(
        documento.claveObjeto,
        claveDefinitiva,
        documento.tipoMimeReal,
      );

      await this.prisma.documento.update({
        where: { id: documento.id },
        data: {
          estadoAntivirus: 'limpio',
          claveObjeto: claveDefinitiva,
          bucket: this.almacenamiento.bucketDocumentos,
          analizadoEl: new Date(),
          resultadoAnalisis: 'limpio',
        },
      });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.documento.update({
        where: { id: documento.id },
        data: {
          estadoAntivirus: veredicto.estado,
          analizadoEl: new Date(),
          resultadoAnalisis: veredicto.detalle?.slice(0, 200) ?? null,
        },
      });

      await this.auditoria.registrar(tx, {
        accion: 'documento.cuarentena',
        tipoRecurso: 'documento',
        recursoId: documento.idPublico,
        resultado: veredicto.estado === 'infectado' ? 'denegado' : 'error',
        motivo: veredicto.detalle ?? null,
        despues: { estadoAntivirus: veredicto.estado },
      });
    });
  }

  /**
   * Prepara la descarga (RF-051, RF-052, RF-055).
   *
   * La politica ya resolvio la relacion y adjunto el documento. Aqui solo
   * quedan la comprobacion de estado y el registro, que ocurre **siempre**:
   * cada descarga y cada denegacion dejan constancia con solicitante, titular,
   * documento, resultado y motivo.
   */
  async prepararDescarga(
    actor: Actor,
    documento: {
      id: string;
      idPublico: string;
      titularId: string;
      claveObjeto: string;
      bucket: string;
      nombreOriginal: string;
      tipoMimeReal: string;
      estadoAntivirus: string;
    },
    motivo?: string,
  ) {
    const esTitular = documento.titularId === actor.usuarioId;

    // Descarga administrativa sobre documento ajeno: exige motivo (RF-052).
    if (!esTitular && !motivo) {
      throw new ErrorNegocio(
        'MOTIVO_REQUERIDO',
        'Descargar el documento de otra persona exige indicar un motivo, que queda registrado.',
      );
    }

    if (documento.estadoAntivirus !== 'limpio') {
      await this.auditoria.registrarFueraDeMutacion({
        accion: 'documento.descarga',
        tipoRecurso: 'documento',
        recursoId: documento.idPublico,
        resultado: 'denegado',
        motivo: `estado-antivirus:${documento.estadoAntivirus}`,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
      });

      throw new ErrorNegocio(
        'DOCUMENTO_NO_DISPONIBLE',
        'El documento todavia se esta analizando o fue retenido.',
        HttpStatus.CONFLICT,
      );
    }

    await this.auditoria.registrarFueraDeMutacion({
      accion: 'documento.descarga',
      tipoRecurso: 'documento',
      recursoId: documento.idPublico,
      resultado: 'exito',
      motivo: motivo ?? null,
      actorId: actor.usuarioId,
      actorCorreo: actor.correo,
      despues: { titular: documento.titularId, esTitular, administrativa: !esTitular },
    });

    // La lectura del objeto ocurre DESPUES de autorizar y registrar (RNFS-042).
    const flujo = await this.almacenamiento.obtener(documento.bucket, documento.claveObjeto);

    return {
      flujo,
      nombreOriginal: documento.nombreOriginal,
      tipoMime: documento.tipoMimeReal,
    };
  }

  /**
   * Reescaneo periodico del almacen (RF-054).
   *
   * Responde a algo que ninguna fase temprana puede resolver, y que
   * SC-LAB-002 escenario A formula con precision: **el archivo no cambia,
   * cambia lo que sabemos sobre el**. Un archivo que hoy pasa limpio puede
   * reconocerse como malicioso manana, cuando las firmas se actualicen.
   *
   * Reanaliza los que YA estan marcados como limpios —que es justamente el
   * punto— y solo cambia el estado si el veredicto cambia. Marcarlos como
   * pendientes por adelantado dejaria el expediente de todo el mundo
   * inaccesible cada madrugada, convirtiendo un control de seguridad en una
   * denegacion de servicio contra los usuarios legitimos.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async reescanearAlmacen(): Promise<void> {
    const haceUnaSemana = new Date(Date.now() - 7 * 86_400_000);

    const pendientes = await this.prisma.documento.findMany({
      where: {
        eliminadoEl: null,
        estadoAntivirus: { in: ['limpio', 'error-analisis'] },
        OR: [{ analizadoEl: null }, { analizadoEl: { lt: haceUnaSemana } }],
      },
      take: 200,
      select: {
        id: true,
        idPublico: true,
        bucket: true,
        claveObjeto: true,
        estadoAntivirus: true,
      },
    });

    this.logger.log(`Reescaneo periodico: ${pendientes.length} documentos`);

    for (const documento of pendientes) {
      try {
        const flujo = await this.almacenamiento.obtener(documento.bucket, documento.claveObjeto);
        const veredicto = await this.antivirus.analizar(flujo);

        if (veredicto.estado === documento.estadoAntivirus) {
          // Sin cambio de veredicto: solo se refresca la fecha, para no
          // reanalizarlo manana otra vez.
          await this.prisma.documento.update({
            where: { id: documento.id },
            data: { analizadoEl: new Date() },
          });
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.documento.update({
            where: { id: documento.id },
            data: {
              estadoAntivirus: veredicto.estado,
              analizadoEl: new Date(),
              resultadoAnalisis: veredicto.detalle?.slice(0, 200) ?? null,
            },
          });

          await this.auditoria.registrar(tx, {
            accion: 'documento.cuarentena',
            tipoRecurso: 'documento',
            recursoId: documento.idPublico,
            resultado: 'denegado',
            motivo: `reescaneo:${veredicto.detalle ?? veredicto.estado}`,
            antes: { estadoAntivirus: documento.estadoAntivirus },
            despues: { estadoAntivirus: veredicto.estado },
          });
        });

        this.logger.warn(
          { documentoId: documento.idPublico, veredicto: veredicto.estado },
          'El reescaneo cambio el veredicto de un documento previamente aceptado',
        );
      } catch (error) {
        this.logger.error({ error, documentoId: documento.idPublico }, 'Fallo el reescaneo');
      }
    }
  }

  private async auditarRechazo(actor: Actor, razon: string, tipoDocumento: string): Promise<void> {
    await this.auditoria.registrarFueraDeMutacion({
      accion: 'documento.carga',
      tipoRecurso: 'documento',
      resultado: 'denegado',
      motivo: razon,
      actorId: actor.usuarioId,
      actorCorreo: actor.correo,
      despues: { tipoDocumento },
    });
  }
}
