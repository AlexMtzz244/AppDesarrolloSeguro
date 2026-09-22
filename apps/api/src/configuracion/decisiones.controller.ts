import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CATALOGO_DECISIONES,
  DECISIONES,
  esquemaMotivo,
  type IdDecision,
} from '@securecampus/contracts';
import { ActorActual, type Actor } from '../autorizacion/actor.js';
import { Politica } from '../autorizacion/politica.decorator.js';
import { validar } from '../comun/zod-validacion.pipe.js';
import { DecisionesService } from './decisiones.service.js';

const esquemaAprobar = z.object({
  /**
   * Quién firma. Es texto libre a propósito: la autoridad que aprueba puede no
   * tener cuenta en el sistema —dirección académica, jurídico— y forzarla a
   * tenerla solo para firmar crearía cuentas privilegiadas sin uso operativo,
   * que son exactamente las que se olvidan y se acumulan.
   */
  aprobadoPor: z.string().trim().min(3).max(200),
  motivo: esquemaMotivo,
});

/**
 * Consulta y aprobación de las decisiones institucionales (SC-SRS-001 §8).
 *
 * Aprobar una decisión es un cambio en el modelo de configuración con efectos
 * sobre la seguridad, así que exige `rol:administrar`, segundo factor y motivo
 * escrito — el mismo trato que un cambio de privilegio.
 */
@ApiTags('configuracion')
@Controller('decisiones')
export class DecisionesController {
  constructor(private readonly decisiones: DecisionesService) {}

  @Get()
  @Politica({ permiso: 'perfil:leer', relacion: 'no-aplica' })
  @ApiOperation({
    summary: 'Estado de aprobación de las once decisiones institucionales',
    description:
      'Visible para cualquier usuario autenticado a propósito: que el sistema ' +
      'opera bajo propuestas sin firmar no es un secreto que convenga guardar. ' +
      'Ocultarlo sería volver invisible justo lo que este mecanismo existe para ' +
      'hacer visible.',
  })
  async listar(@ActorActual() _actor: Actor) {
    const estado = await this.decisiones.estado();
    return estado.map((e) => ({
      ...e,
      titulo: CATALOGO_DECISIONES[e.id].titulo,
      apruebaArea: CATALOGO_DECISIONES[e.id].apruebaArea,
      bloqueaProduccion: CATALOGO_DECISIONES[e.id].bloqueaProduccion,
      propuesta: CATALOGO_DECISIONES[e.id].propuesta,
    }));
  }

  @Post(':id/aprobar')
  @Politica({
    permiso: 'rol:administrar',
    relacion: 'no-aplica',
    exigeMfa: true,
    exigeMotivo: true,
  })
  @ApiOperation({
    summary: 'Registra la firma de una decisión institucional',
    description:
      'Marca los parámetros de esa decisión como aprobados, con quién firmó y ' +
      'cuándo. Queda en la bitácora, y al ser append-only la aprobación no se ' +
      'puede borrar después.',
  })
  async aprobar(
    @ActorActual() actor: Actor,
    @Param('id') id: string,
    @Body(validar(esquemaAprobar)) cuerpo: { aprobadoPor: string; motivo: string },
  ) {
    if (!(DECISIONES as readonly string[]).includes(id)) {
      // Un identificador desconocido se trata como recurso inexistente, sin
      // enumerar cuáles existen.
      return { aprobada: false };
    }
    return this.decisiones.aprobar(actor, id as IdDecision, cuerpo.aprobadoPor, cuerpo.motivo);
  }
}
