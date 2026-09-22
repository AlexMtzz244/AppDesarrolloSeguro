import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import {
  esquemaCapturaLote,
  esquemaCorregirCalificacion,
  esquemaPublicarCalificaciones,
} from '@securecampus/contracts';
import { ActorActual, type Actor } from '../autorizacion/actor.js';
import { Politica } from '../autorizacion/politica.decorator.js';
import {
  calificacionPublicadaCorregible,
  calificacionVisible,
  grupoAsignadoVigente,
} from '../autorizacion/relaciones.js';
import { validar } from '../comun/zod-validacion.pipe.js';
import { CalificacionesService } from './calificaciones.service.js';

type GrupoResuelto = { grupo: { id: string; idPublico: string } };
type CalificacionResuelta = {
  id: string;
  idPublico: string;
  estado: string;
  valor: Prisma.Decimal;
  versionActual: number;
  estudianteId: string;
  grupoId: string;
};

@ApiTags('calificaciones')
@Controller('calificaciones')
export class CalificacionesController {
  constructor(private readonly calificaciones: CalificacionesService) {}

  @Get('mias')
  @Politica({ permiso: 'calificacion:leer', relacion: 'no-aplica' })
  @ApiOperation({
    summary: 'Calificaciones del propio estudiante (RF-040)',
    description:
      'No recibe identificador de estudiante: filtra por la sesion. No existe ' +
      'un endpoint que devuelva las calificaciones de un alumno arbitrario.',
  })
  async mias(@ActorActual() actor: Actor) {
    return this.calificaciones.misCalificaciones(actor);
  }

  @Get('grupo/:grupoId')
  @Politica({ permiso: 'calificacion:leer', relacion: grupoAsignadoVigente })
  @ApiOperation({
    summary: 'Lista de captura del grupo (RF-041)',
    description:
      'Exige asignacion docente VIGENTE sobre el grupo, no el rol profesor ' +
      '(SC-LAB-001 escenario 1).',
  })
  async listaDeCaptura(@Req() req: Request & { recurso?: GrupoResuelto }) {
    return this.calificaciones.listaDeCaptura(req.recurso!.grupo.id);
  }

  @Post('captura')
  @Politica({ permiso: 'calificacion:crear', relacion: grupoAsignadoVigente })
  @ApiOperation({
    summary: 'Captura calificaciones en borrador (RF-042)',
    description:
      'Exige asignacion vigente y periodo abierto. Rechaza cualquier ' +
      'calificacion ya publicada que venga en el lote.',
  })
  async capturar(
    @ActorActual() actor: Actor,
    @Req() req: Request & { recurso?: GrupoResuelto },
    @Body(validar(esquemaCapturaLote))
    cuerpo: { grupoId: string; calificaciones: { estudianteId: string; valor: number }[] },
  ) {
    return this.calificaciones.capturarLote(actor, req.recurso!.grupo, cuerpo.calificaciones);
  }

  @Post('publicar')
  @Politica({ permiso: 'calificacion:publicar', relacion: grupoAsignadoVigente })
  @ApiOperation({
    summary: 'Publica calificaciones en borrador (RF-043)',
    description: 'Tras publicar, cualquier cambio exige el flujo de correccion.',
  })
  async publicar(
    @ActorActual() actor: Actor,
    @Req() req: Request & { recurso?: GrupoResuelto },
    @Body(validar(esquemaPublicarCalificaciones))
    cuerpo: { grupoId: string; calificacionIds: string[] },
  ) {
    return this.calificaciones.publicar(actor, req.recurso!.grupo, cuerpo.calificacionIds);
  }

  @Post(':id/corregir')
  @Politica({
    permiso: 'calificacion:corregir',
    relacion: calificacionPublicadaCorregible,
    exigeMotivo: true,
    exigeMfa: true,
  })
  @ApiOperation({
    summary: 'Corrige una calificacion publicada (RF-044)',
    description:
      'Permiso propio e incompatible con capturar (RNFS-007), motivo ' +
      'obligatorio, version previa conservada y notificacion al estudiante que ' +
      'no se puede desactivar.',
  })
  async corregir(
    @ActorActual() actor: Actor,
    @Req() req: Request & { recurso?: CalificacionResuelta },
    @Param('id') _id: string,
    @Body(validar(esquemaCorregirCalificacion))
    cuerpo: { calificacionId: string; valorNuevo: number; motivo: string },
  ) {
    return this.calificaciones.corregir(actor, req.recurso!, cuerpo.valorNuevo, cuerpo.motivo);
  }

  @Get(':id/historial')
  @Politica({ permiso: 'calificacion:leer', relacion: calificacionVisible })
  @ApiOperation({
    summary: 'Historial de versiones de la calificacion (RF-045)',
    description:
      'Visible para el titular y para el profesor con asignacion vigente. ' +
      'Es lo que permite responder "cual era el valor anterior" — sin esto, ' +
      'la duda contamina el periodo completo (SC-LAB-001 §5.5).',
  })
  async historial(@Req() req: Request & { recurso?: CalificacionResuelta }) {
    return this.calificaciones.historial(req.recurso!.id);
  }
}
