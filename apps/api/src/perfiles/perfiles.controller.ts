import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ActorActual, type Actor } from '../autorizacion/actor.js';
import { Politica } from '../autorizacion/politica.decorator.js';
import { soloMiPerfil } from '../autorizacion/relaciones.js';
import { PrismaService } from '../comun/prisma.service.js';
import { validar } from '../comun/zod-validacion.pipe.js';
import { PerfilesService } from './perfiles.service.js';

/**
 * Campos que el titular puede modificar de su propio perfil (RF-012).
 *
 * Es una lista blanca cortisima a proposito: D-02 esta pendiente de servicios
 * escolares, y el valor por defecto seguro es "casi nada editable". Nombre,
 * apellidos y matricula NO estan aqui — son datos que la institucion asigna, y
 * permitir cambiarlos convertiria el perfil en una via de suplantacion.
 *
 * Que sea un esquema Zod y no un filtro manual importa: lo que no se declara
 * aqui no llega al servicio, asi que agregar un campo al formulario del
 * navegador no lo hace editable (defensa contra mass assignment).
 */
const esquemaActualizarPerfil = z.object({
  telefono: z
    .string()
    .trim()
    .regex(/^[0-9+\-() ]{7,30}$/, 'Telefono invalido')
    .nullable()
    .optional(),
});

@ApiTags('perfiles')
@Controller('perfiles')
export class PerfilesController {
  constructor(
    private readonly perfiles: PerfilesService,
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Consulta de perfil (RF-011).
   *
   * Es el caso de Maria de SC-LAB-001 §3, cerrado. El resolvedor `soloMiPerfil`
   * compara el identificador de la ruta con el de la sesion **antes** de
   * consultar nada: si no coinciden, el registro ajeno ni siquiera se lee.
   *
   * Prueba negativa 1: estudiante A pide `/perfiles/{id-de-B}` -> 403 y evento.
   */
  @Get(':id')
  @Politica({ permiso: 'perfil:leer', relacion: soloMiPerfil })
  @ApiOperation({
    summary: 'Consulta un perfil (RF-011)',
    description:
      'Solo el propio. Un identificador ajeno recibe 403 sin revelar si existe ' +
      '(RNFS-005, RNFS-006).',
  })
  async consultar(@ActorActual() actor: Actor, @Param('id') _id: string) {
    // El parametro ya lo valido la politica; la consulta se hace por el
    // identificador de la SESION, no por el de la ruta. Aunque el resolvedor
    // tuviera un fallo, aqui no hay forma de leer un perfil ajeno.
    return this.perfiles.obtenerPropio(actor.usuarioId);
  }

  @Patch(':id')
  @Politica({ permiso: 'perfil:modificar', relacion: soloMiPerfil })
  @ApiOperation({
    summary: 'Actualiza los campos habilitados del propio perfil (RF-012)',
    description:
      'El conjunto de campos editables es configurable (D-02). Por omision solo ' +
      'el telefono: nombre y matricula los asigna la institucion.',
  })
  async actualizar(
    @ActorActual() actor: Actor,
    @Param('id') _id: string,
    @Body(validar(esquemaActualizarPerfil)) cambios: { telefono?: string | null },
  ) {
    return this.perfiles.actualizarPropio(actor, cambios);
  }
}
