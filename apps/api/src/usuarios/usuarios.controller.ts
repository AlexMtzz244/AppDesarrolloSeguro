import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { esquemaCorreoInstitucional, esquemaMotivo, esquemaPaginacion } from '@securecampus/contracts';
import { ActorActual, type Actor } from '../autorizacion/actor.js';
import { Politica } from '../autorizacion/politica.decorator.js';
import { validar } from '../comun/zod-validacion.pipe.js';
import { UsuariosService } from './usuarios.service.js';

const esquemaCrearUsuario = z.object({
  correo: esquemaCorreoInstitucional,
  nombre: z.string().trim().min(1).max(120),
  apellidoPaterno: z.string().trim().min(1).max(120),
  apellidoMaterno: z.string().trim().max(120).optional(),
  matricula: z.string().trim().max(30).optional(),
  programaClave: z.string().trim().max(20).optional(),
  rolClave: z.string().trim().min(1).max(40),
  motivo: esquemaMotivo,
  // La contrasena inicial la fija el administrador y el usuario debera
  // cambiarla. No se genera aqui y se muestra en pantalla porque acabaria
  // copiada en un chat; el flujo correcto es que el titular use la
  // recuperacion de cuenta para fijar la suya.
  contrasenaInicial: z.string().min(12).max(128),
});

const esquemaCambioEstado = z.object({
  activo: z.boolean(),
  motivo: esquemaMotivo,
});

const esquemaAsignarRol = z.object({
  rolClave: z.string().trim().min(1).max(40),
  motivo: esquemaMotivo,
  hastaEl: z.coerce.date().nullable().default(null),
});

/**
 * Administracion de usuarios y roles (RF-013, RF-014, RF-070 a RF-072).
 *
 * Todas las rutas exigen `exigeMfa`. Son las operaciones que reconfiguran el
 * propio modelo de autorizacion: si una cuenta administrativa se compromete,
 * el segundo factor es lo que queda entre el atacante y el control total que
 * SC-LAB-001 escenario 4 describe como impacto maximo.
 */
@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @Politica({ permiso: 'usuario:leer', relacion: 'no-aplica', exigeMfa: true })
  @ApiOperation({ summary: 'Lista usuarios con su estado y asignaciones vigentes (RF-014)' })
  async listar(@Query(validar(esquemaPaginacion)) q: { pagina: number; tamano: number }) {
    return this.usuarios.listar(q.pagina, q.tamano);
  }

  @Post()
  @Politica({ permiso: 'usuario:crear', relacion: 'no-aplica', exigeMfa: true, exigeMotivo: true })
  @ApiOperation({ summary: 'Crea un usuario con su perfil y rol inicial (RF-013)' })
  async crear(
    @ActorActual() actor: Actor,
    @Body(validar(esquemaCrearUsuario)) cuerpo: z.infer<typeof esquemaCrearUsuario>,
  ) {
    return this.usuarios.crear(actor, cuerpo);
  }

  @Patch(':id/estado')
  @Politica({
    permiso: 'usuario:modificar',
    relacion: 'no-aplica',
    exigeMfa: true,
    exigeMotivo: true,
  })
  @ApiOperation({
    summary: 'Activa o desactiva una cuenta (RF-013)',
    description: 'Desactivar revoca de inmediato todas las sesiones de esa cuenta.',
  })
  async cambiarEstado(
    @ActorActual() actor: Actor,
    @Param('id') id: string,
    @Body(validar(esquemaCambioEstado)) cuerpo: { activo: boolean; motivo: string },
  ) {
    return this.usuarios.cambiarEstado(actor, id, cuerpo.activo, cuerpo.motivo);
  }

  @Post(':id/roles')
  @Politica({ permiso: 'rol:administrar', relacion: 'no-aplica', exigeMfa: true, exigeMotivo: true })
  @ApiOperation({
    summary: 'Asigna un rol con vigencia y motivo (RF-071)',
    description:
      'Rechaza combinaciones que violen la separacion de funciones, evaluadas ' +
      'sobre los permisos acumulados del usuario (RNFS-007).',
  })
  async asignarRol(
    @ActorActual() actor: Actor,
    @Param('id') id: string,
    @Body(validar(esquemaAsignarRol))
    cuerpo: { rolClave: string; motivo: string; hastaEl: Date | null },
  ) {
    return this.usuarios.asignarRol(actor, id, cuerpo.rolClave, cuerpo.motivo, cuerpo.hastaEl);
  }

  @Patch('roles/:asignacionId/revocar')
  @Politica({ permiso: 'rol:administrar', relacion: 'no-aplica', exigeMfa: true, exigeMotivo: true })
  @ApiOperation({ summary: 'Revoca una asignacion de rol (RF-072)' })
  async revocarRol(
    @ActorActual() actor: Actor,
    @Param('asignacionId') asignacionId: string,
    @Body(validar(z.object({ motivo: esquemaMotivo }))) cuerpo: { motivo: string },
  ) {
    return this.usuarios.revocarRol(actor, asignacionId, cuerpo.motivo);
  }
}
