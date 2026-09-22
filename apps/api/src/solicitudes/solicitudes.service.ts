import { HttpStatus, Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { AccesoDenegado, ErrorNegocio } from '../comun/excepciones.filter.js';
import { PrismaService } from '../comun/prisma.service.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';

/**
 * Solicitudes (RF-060 a RF-063).
 *
 * El catalogo de tipos, estados, responsables y SLA vive **en la base de
 * datos**, no en el codigo. D-01 esta pendiente de servicios escolares, y el
 * prompt maestro es explicito en no inventar reglas academicas fijas.
 *
 * La consecuencia practica es que el sistema arranca sin ningun tipo de
 * solicitud dado de alta, y no puede crearse ninguna hasta que la institucion
 * defina el catalogo. Parece un inconveniente y es el comportamiento deseado:
 * como dice SC-SRS-001 §8, "codificar un valor inventado no lo convierte en
 * decidido, lo convierte en invisible, que es peor".
 */
@Injectable()
export class SolicitudesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async catalogo() {
    const tipos = await this.prisma.tipoSolicitud.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: {
        idPublico: true,
        clave: true,
        nombre: true,
        descripcion: true,
        slaHoras: true,
        estados: {
          orderBy: { orden: 'asc' },
          select: { idPublico: true, clave: true, nombre: true, esInicial: true, esFinal: true },
        },
      },
    });
    return tipos;
  }

  /** Solicitudes del propio usuario (RF-061). */
  async misSolicitudes(actor: Actor) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: { titularId: actor.usuarioId },
      orderBy: { creadaEl: 'desc' },
      select: {
        idPublico: true,
        descripcion: true,
        creadaEl: true,
        actualizadaEl: true,
        venceEl: true,
        cerradaEl: true,
        tipoSolicitud: { select: { clave: true, nombre: true } },
        estado: { select: { clave: true, nombre: true, esFinal: true } },
      },
    });

    return solicitudes.map((s) => ({
      id: s.idPublico,
      tipo: s.tipoSolicitud,
      estado: s.estado,
      descripcion: s.descripcion,
      creadaEl: s.creadaEl.toISOString(),
      actualizadaEl: s.actualizadaEl.toISOString(),
      venceEl: s.venceEl?.toISOString() ?? null,
      cerradaEl: s.cerradaEl?.toISOString() ?? null,
    }));
  }

  async detalle(solicitudId: string) {
    const historial = await this.prisma.historialSolicitud.findMany({
      where: { solicitudId },
      orderBy: { creadoEl: 'asc' },
      select: {
        comentario: true,
        creadoEl: true,
        estado: { select: { clave: true, nombre: true } },
      },
    });

    const adjuntos = await this.prisma.solicitudAdjunto.findMany({
      where: { solicitudId },
      select: {
        documento: {
          select: { idPublico: true, nombreOriginal: true, estadoAntivirus: true },
        },
      },
    });

    return {
      historial: historial.map((h) => ({
        estado: h.estado,
        comentario: h.comentario,
        creadoEl: h.creadoEl.toISOString(),
      })),
      adjuntos: adjuntos.map((a) => ({
        id: a.documento.idPublico,
        nombreOriginal: a.documento.nombreOriginal,
        disponible: a.documento.estadoAntivirus === 'limpio',
      })),
    };
  }

  async crear(
    actor: Actor,
    tipoSolicitudIdPublico: string,
    descripcion: string,
    documentoIdsPublicos: readonly string[],
  ) {
    const tipo = await this.prisma.tipoSolicitud.findUnique({
      where: { idPublico: tipoSolicitudIdPublico },
      select: {
        id: true,
        clave: true,
        activo: true,
        slaHoras: true,
        estados: { where: { esInicial: true }, select: { id: true, clave: true }, take: 1 },
      },
    });

    if (!tipo?.activo) {
      throw new ErrorNegocio(
        'TIPO_SOLICITUD_DESCONOCIDO',
        'El tipo de solicitud no existe o no esta habilitado.',
      );
    }

    const estadoInicial = tipo.estados[0];
    if (!estadoInicial) {
      throw new ErrorNegocio(
        'CATALOGO_INCOMPLETO',
        'El tipo de solicitud no tiene un estado inicial configurado. ' +
          'Avisa al administrador: el catalogo esta incompleto.',
        HttpStatus.CONFLICT,
      );
    }

    // Los adjuntos deben pertenecer al propio solicitante. Sin esto, conocer
    // el identificador de un documento ajeno permitiria adjuntarlo a una
    // solicitud propia y leerlo desde ahi — el IDOR entrando por la puerta de
    // al lado.
    const documentos = documentoIdsPublicos.length
      ? await this.prisma.documento.findMany({
          where: {
            idPublico: { in: [...documentoIdsPublicos] },
            titularId: actor.usuarioId,
            eliminadoEl: null,
          },
          select: { id: true },
        })
      : [];

    if (documentos.length !== documentoIdsPublicos.length) {
      throw new AccesoDenegado();
    }

    return this.prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitud.create({
        data: {
          idPublico: ulid(),
          titularId: actor.usuarioId,
          tipoSolicitudId: tipo.id,
          estadoId: estadoInicial.id,
          descripcion,
          venceEl: tipo.slaHoras
            ? new Date(Date.now() + tipo.slaHoras * 3_600_000)
            : null,
          historial: {
            create: {
              estadoId: estadoInicial.id,
              autorId: actor.usuarioId,
              comentario: 'Solicitud creada',
            },
          },
          adjuntos: { create: documentos.map((d) => ({ documentoId: d.id })) },
        },
        select: { id: true, idPublico: true, venceEl: true },
      });

      await this.auditoria.registrar(tx, {
        accion: 'solicitud.alta',
        tipoRecurso: 'solicitud',
        recursoId: solicitud.idPublico,
        resultado: 'exito',
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        despues: {
          tipo: tipo.clave,
          estado: estadoInicial.clave,
          adjuntos: documentos.length,
        },
      });

      return {
        id: solicitud.idPublico,
        estado: estadoInicial.clave,
        venceEl: solicitud.venceEl?.toISOString() ?? null,
      };
    });
  }

  /** Cambia el estado de una solicitud (RF-062). Solo el responsable. */
  async cambiarEstado(
    actor: Actor,
    solicitud: { id: string; idPublico: string; titularId: string; tipoSolicitudId: string; estadoId: string },
    estadoDestinoIdPublico: string,
    comentario?: string,
  ) {
    const destino = await this.prisma.estadoSolicitud.findUnique({
      where: { idPublico: estadoDestinoIdPublico },
      select: { id: true, clave: true, nombre: true, esFinal: true, tipoSolicitudId: true },
    });

    // El estado destino tiene que pertenecer al MISMO tipo de solicitud. Sin
    // esta comprobacion se podria mover una solicitud de constancia a un
    // estado del flujo de bajas, dejando el catalogo sin sentido.
    if (!destino || destino.tipoSolicitudId !== solicitud.tipoSolicitudId) {
      throw new ErrorNegocio(
        'ESTADO_INVALIDO',
        'El estado indicado no pertenece a este tipo de solicitud.',
      );
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const anterior = await tx.estadoSolicitud.findUniqueOrThrow({
        where: { id: solicitud.estadoId },
        select: { clave: true },
      });

      await tx.solicitud.update({
        where: { id: solicitud.id },
        data: {
          estadoId: destino.id,
          responsableId: actor.usuarioId,
          cerradaEl: destino.esFinal ? new Date() : null,
        },
      });

      await tx.historialSolicitud.create({
        data: {
          solicitudId: solicitud.id,
          estadoId: destino.id,
          autorId: actor.usuarioId,
          comentario: comentario ?? null,
        },
      });

      await this.auditoria.registrar(tx, {
        accion: 'solicitud.cambio-estado',
        tipoRecurso: 'solicitud',
        recursoId: solicitud.idPublico,
        resultado: 'exito',
        motivo: comentario ?? null,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        antes: { estado: anterior.clave },
        despues: { estado: destino.clave },
      });

      return { titularId: solicitud.titularId, estado: destino.nombre };
    });

    await this.notificaciones.encolar({
      destinatarioId: resultado.titularId,
      tipo: 'solicitud-actualizada',
      canal: 'en-aplicacion',
      titulo: 'Tu solicitud cambio de estado',
      cuerpo: `Tu solicitud pasó al estado: ${resultado.estado}.`,
      claveIdempotencia: `solicitud-estado:${solicitud.idPublico}:${destino.id}`,
    });

    return { id: solicitud.idPublico, estado: destino.clave };
  }
}
