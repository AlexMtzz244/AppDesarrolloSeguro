import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { esquemaFiltroAuditoria, type FiltroAuditoria } from '@securecampus/contracts';
import { Politica } from '../autorizacion/politica.decorator.js';
import { PrismaService } from '../comun/prisma.service.js';
import { validar } from '../comun/zod-validacion.pipe.js';

/**
 * Consulta de la bitacora (RF-080, RF-081).
 *
 * **Este controlador no tiene POST, PATCH ni DELETE, y esa ausencia es el
 * punto.** RF-081 exige que la API no ofrezca ninguna operacion de edicion o
 * borrado sobre la auditoria.
 *
 * Es la primera de tres capas independientes:
 *   1. La API no expone las operaciones (aqui).
 *   2. El rol de base de datos no tiene el permiso (RNFS-031, migracion 2).
 *   3. Un trigger las rechaza aunque alguien las intente con otro rol.
 *
 * SC-LAB-001 escenario 4 explica por que hacen falta las tres: el impacto que
 * mas teme ese escenario es "borrado o manipulacion de los logs, lo que
 * destruye la evidencia del propio ataque". Si el atacante llego a
 * administrador, la bitacora es lo unico que queda.
 */
@ApiTags('auditoria')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Politica({ permiso: 'auditoria:consultar', relacion: 'no-aplica', exigeMfa: true })
  @ApiOperation({
    summary: 'Consulta la bitacora con filtros y paginacion (RF-080)',
    description:
      'Los campos de ordenamiento y filtro son lista blanca. Los datos ' +
      'sensibles ya vienen saneados desde la escritura del evento.',
  })
  async consultar(@Query(validar(esquemaFiltroAuditoria)) filtro: FiltroAuditoria) {
    const where: Prisma.EventoAuditoriaWhereInput = {};

    if (filtro.actorId) {
      const actor = await this.prisma.usuario.findUnique({
        where: { idPublico: filtro.actorId },
        select: { id: true },
      });
      // Un actor inexistente produce un filtro imposible, no un filtro
      // ignorado: devolver "todo" cuando el filtro no resuelve seria una fuga
      // silenciosa de mas informacion de la pedida.
      where.actorId = actor?.id ?? '00000000-0000-0000-0000-000000000000';
    }

    if (filtro.accion) where.accion = filtro.accion;
    if (filtro.tipoRecurso) where.tipoRecurso = filtro.tipoRecurso;
    if (filtro.recursoId) where.recursoId = filtro.recursoId;
    if (filtro.resultado) where.resultado = filtro.resultado;

    if (filtro.desde || filtro.hasta) {
      where.creadoEl = {
        ...(filtro.desde ? { gte: filtro.desde } : {}),
        ...(filtro.hasta ? { lte: filtro.hasta } : {}),
      };
    }

    const [total, eventos] = await Promise.all([
      this.prisma.eventoAuditoria.count({ where }),
      this.prisma.eventoAuditoria.findMany({
        where,
        // `ordenarPor` viene de un `z.enum`, no de texto libre: no hay forma de
        // inyectar una expresion de ordenamiento arbitraria.
        orderBy: { [filtro.ordenarPor]: filtro.orden },
        skip: (filtro.pagina - 1) * filtro.tamano,
        take: filtro.tamano,
        select: {
          id: true,
          creadoEl: true,
          actorCorreo: true,
          accion: true,
          tipoRecurso: true,
          recursoId: true,
          resultado: true,
          motivo: true,
          antes: true,
          despues: true,
          ip: true,
          userAgent: true,
          correlationId: true,
        },
      }),
    ]);

    return {
      datos: eventos.map((e) => ({ ...e, creadoEl: e.creadoEl.toISOString() })),
      pagina: filtro.pagina,
      tamano: filtro.tamano,
      total,
    };
  }

  @Get('exportar')
  @Politica({ permiso: 'auditoria:consultar', relacion: 'no-aplica', exigeMfa: true })
  @ApiOperation({
    summary: 'Exportacion controlada de la bitacora (RF-080)',
    description:
      'Limitada a 5000 registros por exportacion. El tope no es arbitrario: ' +
      'una exportacion sin limite es una fuga masiva de datos personales ' +
      'disfrazada de funcion administrativa.',
  })
  async exportar(@Query(validar(esquemaFiltroAuditoria)) filtro: FiltroAuditoria) {
    const where: Prisma.EventoAuditoriaWhereInput = {};
    if (filtro.accion) where.accion = filtro.accion;
    if (filtro.resultado) where.resultado = filtro.resultado;
    if (filtro.desde || filtro.hasta) {
      where.creadoEl = {
        ...(filtro.desde ? { gte: filtro.desde } : {}),
        ...(filtro.hasta ? { lte: filtro.hasta } : {}),
      };
    }

    const eventos = await this.prisma.eventoAuditoria.findMany({
      where,
      orderBy: { creadoEl: 'desc' },
      take: 5000,
      select: {
        creadoEl: true,
        actorCorreo: true,
        accion: true,
        tipoRecurso: true,
        recursoId: true,
        resultado: true,
        motivo: true,
        correlationId: true,
        // `antes` y `despues` NO se exportan: pueden contener datos personales
        // del sujeto de la operacion, y una exportacion sale del sistema y ya
        // no vuelve a estar bajo nuestro control. Para el detalle hay que
        // consultar el evento concreto, que queda auditado.
      },
    });

    return {
      generadoEl: new Date().toISOString(),
      registros: eventos.length,
      truncado: eventos.length === 5000,
      datos: eventos.map((e) => ({ ...e, creadoEl: e.creadoEl.toISOString() })),
    };
  }
}
