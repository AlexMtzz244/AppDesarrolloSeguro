import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  esquemaCambiarEstadoSolicitud,
  esquemaCrearSolicitud,
} from '@securecampus/contracts';
import { ActorActual, type Actor } from '../autorizacion/actor.js';
import { Politica } from '../autorizacion/politica.decorator.js';
import { soloMiSolicitud } from '../autorizacion/relaciones.js';
import { validar } from '../comun/zod-validacion.pipe.js';
import { SolicitudesService } from './solicitudes.service.js';

type SolicitudResuelta = {
  id: string;
  idPublico: string;
  titularId: string;
  tipoSolicitudId: string;
  estadoId: string;
};

@ApiTags('solicitudes')
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudes: SolicitudesService) {}

  @Get('catalogo')
  @Politica({ permiso: 'solicitud:leer', relacion: 'no-aplica' })
  @ApiOperation({
    summary: 'Catalogo configurable de tipos y estados (RF-063)',
    description:
      'Vive en la base de datos, no en el codigo. Se siembra vacio: D-01 es ' +
      'una decision de servicios escolares, no del equipo de desarrollo.',
  })
  async catalogo() {
    return this.solicitudes.catalogo();
  }

  @Get('mias')
  @Politica({ permiso: 'solicitud:leer', relacion: 'no-aplica' })
  @ApiOperation({ summary: 'Solicitudes del propio usuario (RF-061)' })
  async mias(@ActorActual() actor: Actor) {
    return this.solicitudes.misSolicitudes(actor);
  }

  @Get(':id')
  @Politica({ permiso: 'solicitud:leer', relacion: soloMiSolicitud })
  @ApiOperation({ summary: 'Historial y adjuntos de una solicitud propia (RF-062)' })
  async detalle(@Req() req: Request & { recurso?: SolicitudResuelta }) {
    return this.solicitudes.detalle(req.recurso!.id);
  }

  @Post()
  @Politica({ permiso: 'solicitud:crear', relacion: 'no-aplica' })
  @ApiOperation({
    summary: 'Crea una solicitud (RF-060)',
    description:
      'Los adjuntos deben ser documentos del propio solicitante; un ' +
      'identificador ajeno recibe 403.',
  })
  async crear(
    @ActorActual() actor: Actor,
    @Body(validar(esquemaCrearSolicitud))
    cuerpo: { tipoSolicitudId: string; descripcion: string; documentoIds: string[] },
  ) {
    return this.solicitudes.crear(
      actor,
      cuerpo.tipoSolicitudId,
      cuerpo.descripcion,
      cuerpo.documentoIds,
    );
  }

  @Patch(':id/estado')
  @Politica({ permiso: 'solicitud:modificar', relacion: soloMiSolicitud })
  @ApiOperation({
    summary: 'Cambia el estado de una solicitud (RF-062)',
    description:
      'Exige `solicitud:modificar`, que el titular no tiene: nadie avanza su ' +
      'propia solicitud. El estado destino debe ser del mismo tipo.',
  })
  async cambiarEstado(
    @ActorActual() actor: Actor,
    @Req() req: Request & { recurso?: SolicitudResuelta },
    @Param('id') _id: string,
    @Body(validar(esquemaCambiarEstadoSolicitud))
    cuerpo: { solicitudId: string; estadoDestinoId: string; comentario?: string },
  ) {
    return this.solicitudes.cambiarEstado(
      actor,
      req.recurso!,
      cuerpo.estadoDestinoId,
      cuerpo.comentario,
    );
  }
}
