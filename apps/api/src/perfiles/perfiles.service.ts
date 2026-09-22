import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { PrismaService } from '../comun/prisma.service.js';

@Injectable()
export class PerfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Nota la firma: recibe `usuarioId`, que sale de la sesion, y **no** un
   * identificador libre.
   *
   * No existe en todo este servicio un metodo `obtenerPorId(id)`. Es la
   * decision de SC-LAB-002 §5: "no existe una firma de consulta que acepte
   * solo el identificador". Si existiera, tarde o temprano algun controlador
   * la llamaria con el parametro de la ruta y el hueco quedaria abierto sin
   * que nadie lo notara.
   */
  async obtenerPropio(usuarioId: string) {
    const perfil = await this.prisma.perfil.findUnique({
      where: { usuarioId },
      select: {
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        matricula: true,
        telefono: true,
        actualizadoEl: true,
        programa: { select: { idPublico: true, clave: true, nombre: true } },
        usuario: { select: { idPublico: true, correo: true, creadoEl: true } },
      },
    });

    if (!perfil) throw new NotFoundException();

    return {
      id: perfil.usuario.idPublico,
      correo: perfil.usuario.correo,
      nombre: perfil.nombre,
      apellidoPaterno: perfil.apellidoPaterno,
      apellidoMaterno: perfil.apellidoMaterno,
      matricula: perfil.matricula,
      telefono: perfil.telefono,
      programa: perfil.programa,
      miembroDesde: perfil.usuario.creadoEl.toISOString(),
      actualizadoEl: perfil.actualizadoEl.toISOString(),
    };
  }

  /**
   * Actualiza el perfil propio y audita el cambio en la misma transaccion
   * (RF-015, RNFS-030).
   */
  async actualizarPropio(actor: Actor, cambios: { telefono?: string | null }) {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.perfil.findUnique({
        where: { usuarioId: actor.usuarioId },
        select: { telefono: true },
      });

      if (!antes) throw new NotFoundException();

      const despues = await tx.perfil.update({
        where: { usuarioId: actor.usuarioId },
        data: cambios,
        select: { telefono: true, actualizadoEl: true },
      });

      await this.auditoria.registrar(tx, {
        accion: 'perfil.modificacion',
        tipoRecurso: 'perfil',
        recursoId: actor.idPublico,
        resultado: 'exito',
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        antes,
        despues: { telefono: despues.telefono },
      });

      return { telefono: despues.telefono, actualizadoEl: despues.actualizadoEl.toISOString() };
    });
  }
}
