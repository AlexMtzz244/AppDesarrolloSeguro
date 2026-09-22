import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  esquemaAltaMfa,
  esquemaCambioContrasena,
  esquemaCompletarRecuperacion,
  esquemaSolicitudLogin,
  esquemaSolicitudRecuperacion,
  esquemaVerificacionMfa,
  type ActorPublico,
} from '@securecampus/contracts';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ActorActual, type Actor } from '../autorizacion/actor.js';
import { Politica, Publico } from '../autorizacion/politica.decorator.js';
import { PrismaService } from '../comun/prisma.service.js';
import { validar } from '../comun/zod-validacion.pipe.js';
import { AutenticacionService } from './autenticacion.service.js';
import { MfaService } from './mfa.service.js';
import { RecuperacionService } from './recuperacion.service.js';
import { SesionService } from './sesion.service.js';

@ApiTags('autenticacion')
@Controller('auth')
export class AutenticacionController {
  constructor(
    private readonly autenticacion: AutenticacionService,
    private readonly recuperacion: RecuperacionService,
    private readonly sesiones: SesionService,
    private readonly mfa: MfaService,
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Publico('El inicio de sesion tiene que ser alcanzable sin sesion previa.')
  @ApiOperation({
    summary: 'Inicia sesion (RF-001)',
    description:
      'Responde identicamente ante correo inexistente y contrasena incorrecta, ' +
      'con latencia equiparada (RNFS-016).',
  })
  async login(
    @Body(validar(esquemaSolicitudLogin)) cuerpo: { correo: string; contrasena: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.autenticacion.iniciarSesion(cuerpo.correo, cuerpo.contrasena, res);
  }

  @Post('mfa/verificar')
  @HttpCode(HttpStatus.OK)
  @Publico('Segundo paso del login: todavia no hay sesion, solo un desafio.')
  @ApiOperation({ summary: 'Verifica el segundo factor (RF-003)' })
  async verificarMfa(
    @Body(validar(esquemaVerificacionMfa)) cuerpo: { desafio: string; codigo: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.autenticacion.verificarMfa(cuerpo.desafio, cuerpo.codigo, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Politica({ permiso: 'perfil:leer', relacion: 'no-aplica' })
  @ApiOperation({ summary: 'Cierra la sesion actual y la revoca en servidor (RF-002)' })
  async logout(@ActorActual() actor: Actor, @Res({ passthrough: true }) res: Response) {
    await this.autenticacion.cerrarSesion(actor.usuarioId, actor.sesionId, res);
  }

  @Get('yo')
  @Politica({ permiso: 'perfil:leer', relacion: 'no-aplica' })
  @ApiOperation({
    summary: 'Identidad y permisos del actor',
    description:
      'El frontend usa esto SOLO para decidir que muestra. Cada endpoint vuelve ' +
      'a verificar en servidor: ocultar una opcion no es un control (RNFS-063).',
  })
  async yo(@ActorActual() actor: Actor): Promise<ActorPublico> {
    const perfil = await this.prisma.perfil.findUnique({
      where: { usuarioId: actor.usuarioId },
      select: { nombre: true, apellidoPaterno: true, programa: { select: { idPublico: true } } },
    });

    const mfaActivo = await this.mfa.estaActivo(actor.usuarioId);

    return {
      id: actor.idPublico,
      correo: actor.correo,
      nombre: perfil ? `${perfil.nombre} ${perfil.apellidoPaterno}` : actor.correo,
      roles: actor.roles as ActorPublico['roles'],
      permisos: [...actor.permisos],
      mfaActivo,
      mfaObligatorio: this.mfa.esObligatorioPara(actor.roles),
      programaId: perfil?.programa?.idPublico ?? null,
    };
  }

  // --- Sesiones (RF-006) ---------------------------------------------------

  @Get('sesiones')
  @Politica({ permiso: 'perfil:leer', relacion: 'no-aplica' })
  @ApiOperation({ summary: 'Lista las sesiones activas del propio usuario' })
  async listarSesiones(@ActorActual() actor: Actor) {
    // La consulta filtra por `actor.usuarioId`, no por un identificador de la
    // ruta. No hay forma de pedir las sesiones de otro: el parametro no existe.
    const sesiones = await this.prisma.sesion.findMany({
      where: { usuarioId: actor.usuarioId, revocadaEl: null, expiraEl: { gt: new Date() } },
      select: {
        idPublico: true,
        creadaEl: true,
        ultimaActividadEl: true,
        ip: true,
        userAgent: true,
      },
      orderBy: { ultimaActividadEl: 'desc' },
    });

    return sesiones.map((s) => ({
      id: s.idPublico,
      creadaEl: s.creadaEl.toISOString(),
      ultimaActividadEl: s.ultimaActividadEl.toISOString(),
      ip: s.ip,
      userAgent: s.userAgent,
      esLaActual: s.idPublico === actor.sesionId,
    }));
  }

  @Delete('sesiones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Politica({ permiso: 'perfil:modificar', relacion: 'no-aplica' })
  @ApiOperation({ summary: 'Revoca una sesion propia' })
  async revocarSesion(@ActorActual() actor: Actor, @Param('id') id: string) {
    await this.prisma.$transaction(async (tx) => {
      // `revocar` filtra por usuarioId internamente: conocer el identificador
      // de una sesion ajena no permite cerrarla.
      const revocada = await this.sesiones.revocar(tx, id, actor.usuarioId, 'revocacion-manual');
      await this.auditoria.registrar(tx, {
        accion: 'sesion.revocacion',
        tipoRecurso: 'sesion',
        recursoId: id,
        resultado: revocada ? 'exito' : 'denegado',
        actorId: actor.usuarioId,
      });
    });
  }

  // --- Contrasena ----------------------------------------------------------

  @Post('contrasena/cambiar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Politica({ permiso: 'perfil:modificar', relacion: 'no-aplica' })
  @ApiOperation({
    summary: 'Cambia la contrasena (RF-005)',
    description: 'Revoca TODAS las sesiones activas al completarse (RNFS-014).',
  })
  async cambiarContrasena(
    @ActorActual() actor: Actor,
    @Body(validar(esquemaCambioContrasena))
    cuerpo: { contrasenaActual: string; contrasenaNueva: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.autenticacion.cambiarContrasena(
      actor.usuarioId,
      actor.correo,
      cuerpo.contrasenaActual,
      cuerpo.contrasenaNueva,
      res,
    );
  }

  // --- Recuperacion: RF-010 reescrito --------------------------------------

  @Post('recuperacion/solicitar')
  @HttpCode(HttpStatus.OK)
  @Publico('Quien perdio el acceso, por definicion, no tiene sesion.')
  @ApiOperation({
    summary: 'Solicita un enlace de recuperacion (RF-010)',
    description:
      'La respuesta es SIEMPRE la misma, exista o no la cuenta (RNFS-020). ' +
      'Cualquier diferencia convertiria este formulario en un enumerador de ' +
      'correos institucionales validos.',
  })
  async solicitarRecuperacion(
    @Body(validar(esquemaSolicitudRecuperacion)) cuerpo: { correo: string },
  ) {
    await this.recuperacion.solicitar(cuerpo.correo);
    return {
      mensaje:
        'Si la cuenta existe, se envio un enlace de recuperacion al correo registrado.',
    };
  }

  @Post('recuperacion/completar')
  @HttpCode(HttpStatus.OK)
  @Publico('Se autentica con el token de un solo uso, no con una sesion.')
  @ApiOperation({
    summary: 'Completa la recuperacion (RF-010)',
    description:
      'Enlace vencido, ya usado, sustituido o inexistente producen la misma ' +
      'respuesta (RNFS-023).',
  })
  async completarRecuperacion(
    @Body(validar(esquemaCompletarRecuperacion))
    cuerpo: { token: string; contrasenaNueva: string },
  ) {
    const exito = await this.recuperacion.completar(cuerpo.token, cuerpo.contrasenaNueva);
    // Se devuelve 200 en ambos casos con un booleano, en vez de 400 al fallar:
    // el codigo de estado es observable sin leer el cuerpo y no debe distinguir
    // un token invalido de uno valido para otra cuenta.
    return { completado: exito };
  }

  // --- Alta del segundo factor (RF-004) ------------------------------------

  @Post('mfa/iniciar')
  @HttpCode(HttpStatus.OK)
  @Politica({ permiso: 'perfil:modificar', relacion: 'no-aplica' })
  @ApiOperation({ summary: 'Genera el secreto TOTP; queda inactivo hasta confirmarlo' })
  async iniciarMfa(@ActorActual() actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const datos = await this.mfa.iniciarAlta(tx, actor.usuarioId, actor.correo);
      await this.auditoria.registrar(tx, {
        accion: 'mfa.alta',
        tipoRecurso: 'credencial-totp',
        recursoId: actor.usuarioId,
        resultado: 'exito',
        actorId: actor.usuarioId,
        despues: { paso: 'secreto-generado' },
      });
      return datos;
    });
  }

  @Post('mfa/confirmar')
  @HttpCode(HttpStatus.OK)
  @Politica({ permiso: 'perfil:modificar', relacion: 'no-aplica' })
  @ApiOperation({ summary: 'Activa el segundo factor y emite codigos de recuperacion' })
  async confirmarMfa(
    @ActorActual() actor: Actor,
    @Body(validar(esquemaAltaMfa)) cuerpo: { codigo: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const resultado = await this.mfa.confirmarAlta(tx, actor.usuarioId, cuerpo.codigo);

      await this.auditoria.registrar(tx, {
        accion: 'mfa.alta',
        tipoRecurso: 'credencial-totp',
        recursoId: actor.usuarioId,
        resultado: resultado ? 'exito' : 'denegado',
        actorId: actor.usuarioId,
        despues: { paso: 'activacion' },
      });

      if (!resultado) {
        return { activado: false, codigosRecuperacion: [] };
      }
      return { activado: true, ...resultado };
    });
  }
}
