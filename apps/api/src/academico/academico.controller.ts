import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import {
  esquemaCrearAsignacionDocente,
  esquemaCrearGrupo,
  esquemaMotivo,
  type CrearGrupo,
} from '@securecampus/contracts';
import { ActorActual, type Actor } from '../autorizacion/actor.js';
import { Politica } from '../autorizacion/politica.decorator.js';
import {
  grupoDeMiPrograma,
  grupoDeMiProgramaEnPeriodoAbierto,
} from '../autorizacion/relaciones.js';
import { validar } from '../comun/zod-validacion.pipe.js';
import { PrismaService } from '../comun/prisma.service.js';
import { AsignacionesService } from './asignaciones.service.js';
import { GruposService } from './grupos.service.js';
import { PeriodosService } from './periodos.service.js';

const esquemaCrearGrupoConMotivo = esquemaCrearGrupo.extend({ motivo: esquemaMotivo });

@ApiTags('academico')
@Controller()
export class AcademicoController {
  constructor(
    private readonly grupos: GruposService,
    private readonly asignaciones: AsignacionesService,
    private readonly periodos: PeriodosService,
    private readonly prisma: PrismaService,
  ) {}

  // --- Catalogos -----------------------------------------------------------

  @Get('periodos')
  @Politica({ permiso: 'periodo:leer', relacion: 'no-aplica' })
  @ApiOperation({ summary: 'Lista los periodos academicos con su estado (RF-021)' })
  async listarPeriodos() {
    return this.periodos.listar();
  }

  @Get('programas/mio')
  @Politica({ permiso: 'programa:leer', relacion: 'no-aplica' })
  @ApiOperation({
    summary: 'Programa de adscripcion del actor (RF-020)',
    description:
      'No recibe identificador: devuelve el programa de la SESION. No existe ' +
      'un endpoint que entregue un programa por identificador arbitrario.',
  })
  async miPrograma(@ActorActual() actor: Actor) {
    if (!actor.programaId) return null;
    return this.prisma.programa.findUnique({
      where: { id: actor.programaId },
      select: { idPublico: true, clave: true, nombre: true },
    });
  }

  @Get('materias')
  @Politica({ permiso: 'materia:leer', relacion: 'no-aplica' })
  @ApiOperation({ summary: 'Materias del programa del actor (RF-022)' })
  async listarMaterias(@ActorActual() actor: Actor) {
    if (!actor.programaId && !actor.permisos.has('materia:administrar')) return [];
    return this.prisma.materia.findMany({
      where: actor.programaId ? { programaId: actor.programaId } : {},
      orderBy: { clave: 'asc' },
      select: { idPublico: true, clave: true, nombre: true, creditos: true },
    });
  }

  @Get('aulas')
  @Politica({ permiso: 'aula:leer', relacion: 'no-aplica' })
  @ApiOperation({ summary: 'Catalogo de aulas (RF-022)' })
  async listarAulas() {
    return this.prisma.aula.findMany({
      orderBy: [{ edificio: 'asc' }, { clave: 'asc' }],
      select: { idPublico: true, clave: true, edificio: true, capacidad: true },
    });
  }

  // --- Grupos --------------------------------------------------------------

  @Get('grupos')
  @Politica({ permiso: 'grupo:leer', relacion: 'no-aplica' })
  @ApiOperation({
    summary: 'Lista los grupos visibles para el actor (RF-024)',
    description:
      'El filtro se deriva de la sesion: su programa si es jefe, sus ' +
      'asignaciones vigentes si es profesor. Sin relacion, el listado es vacio.',
  })
  async listarGrupos(
    @ActorActual() actor: Actor,
    @Query('periodo') periodo?: string,
  ) {
    return this.grupos.listarPara(actor, periodo);
  }

  @Post('grupos')
  @Politica({
    permiso: 'grupo:crear',
    // No hay recurso previo que resolver: se valida contra el programa del
    // actor dentro del servicio, y la materia tambien debe pertenecerle.
    relacion: 'no-aplica',
    exigeMotivo: true,
  })
  @ApiOperation({
    summary: 'Crea un grupo del propio programa (RF-023)',
    description:
      'El programa NO viaja en el cuerpo: sale de la adscripcion del actor ' +
      '(SC-LAB-001 escenario 5, vulnerabilidad c).',
  })
  async crearGrupo(
    @ActorActual() actor: Actor,
    @Body(validar(esquemaCrearGrupoConMotivo))
    cuerpo: CrearGrupo & { motivo: string },
  ) {
    const { motivo, ...datos } = cuerpo;
    return this.grupos.crear(actor, datos, motivo);
  }

  // --- Asignacion docente --------------------------------------------------

  @Get('grupos/:id/asignaciones')
  @Politica({ permiso: 'asignacion-docente:leer', relacion: grupoDeMiPrograma })
  @ApiOperation({
    summary: 'Historial completo de asignaciones del grupo (RF-031)',
    description:
      'Devuelve TODAS las versiones, incluidas las cerradas. Es la vista que ' +
      'hace visible el paso intermedio del escenario 5 de SC-LAB-001.',
  })
  async historialAsignaciones(@Param('id') id: string) {
    return this.asignaciones.historial(id);
  }

  @Post('grupos/:id/asignaciones')
  @Politica({
    permiso: 'asignacion-docente:crear',
    relacion: grupoDeMiProgramaEnPeriodoAbierto,
    exigeMotivo: true,
  })
  @ApiOperation({
    summary: 'Asigna un profesor al grupo (RF-030)',
    description:
      'Cierra la vigencia anterior y abre una version nueva; nunca sobrescribe. ' +
      'Rechaza la autoasignacion y los choques de horario y carga.',
  })
  async asignarProfesor(
    @ActorActual() actor: Actor,
    @Req() req: Request & { recurso?: { id: string; idPublico: string; programaId: string; periodoId: string } },
    @Body(validar(esquemaCrearAsignacionDocente))
    cuerpo: { profesorId: string; desde: Date; hasta: Date | null; motivo: string },
  ) {
    // El grupo ya lo resolvio y valido la politica; reutilizarlo evita el
    // patron de "el guard verifico un registro y el servicio recupero otro".
    const grupo = req.recurso!;
    return this.asignaciones.asignar(
      actor,
      grupo,
      cuerpo.profesorId,
      cuerpo.desde,
      cuerpo.hasta,
      cuerpo.motivo,
    );
  }

  @Post('grupos/:id/asignaciones/cerrar')
  @Politica({
    permiso: 'asignacion-docente:crear',
    relacion: grupoDeMiProgramaEnPeriodoAbierto,
    exigeMotivo: true,
  })
  @ApiOperation({ summary: 'Cierra la asignacion vigente del grupo' })
  async cerrarAsignacion(
    @ActorActual() actor: Actor,
    @Req() req: Request & { recurso?: { id: string; idPublico: string } },
    @Body(validar(z.object({ motivo: esquemaMotivo }))) cuerpo: { motivo: string },
  ) {
    return this.asignaciones.cerrar(actor, req.recurso!, cuerpo.motivo);
  }
}
