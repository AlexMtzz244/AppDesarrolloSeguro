import { HttpStatus, Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import {
  detectarConflictosSeparacion,
  ES_PERMISO,
  type Permiso,
} from '@securecampus/contracts';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { AccesoDenegado, ErrorNegocio } from '../comun/excepciones.filter.js';
import type { ClienteTransaccion } from '../comun/prisma.service.js';
import { PrismaService } from '../comun/prisma.service.js';
import { ContrasenaService } from '../identidad/contrasena.service.js';

export interface DatosNuevoUsuario {
  readonly correo: string;
  readonly nombre: string;
  readonly apellidoPaterno: string;
  readonly apellidoMaterno?: string | undefined;
  readonly matricula?: string | undefined;
  readonly programaClave?: string | undefined;
  readonly rolClave: string;
  readonly motivo: string;
  readonly contrasenaInicial: string;
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contrasenas: ContrasenaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(pagina: number, tamano: number) {
    const [total, usuarios] = await Promise.all([
      this.prisma.usuario.count(),
      this.prisma.usuario.findMany({
        skip: (pagina - 1) * tamano,
        take: tamano,
        orderBy: { creadoEl: 'desc' },
        select: {
          idPublico: true,
          correo: true,
          activo: true,
          creadoEl: true,
          perfil: { select: { nombre: true, apellidoPaterno: true, matricula: true } },
          asignacionesRol: {
            where: { revocadaEl: null },
            select: {
              idPublico: true,
              desdeEl: true,
              hastaEl: true,
              rol: { select: { clave: true, nombre: true } },
            },
          },
        },
      }),
    ]);

    return {
      datos: usuarios.map((u) => ({
        id: u.idPublico,
        correo: u.correo,
        activo: u.activo,
        nombre: u.perfil ? `${u.perfil.nombre} ${u.perfil.apellidoPaterno}` : null,
        matricula: u.perfil?.matricula ?? null,
        creadoEl: u.creadoEl.toISOString(),
        roles: u.asignacionesRol.map((a) => ({
          asignacionId: a.idPublico,
          clave: a.rol.clave,
          nombre: a.rol.nombre,
          desdeEl: a.desdeEl.toISOString(),
          hastaEl: a.hastaEl?.toISOString() ?? null,
        })),
      })),
      pagina,
      tamano,
      total,
    };
  }

  async crear(actor: Actor, datos: DatosNuevoUsuario) {
    const rol = await this.prisma.rol.findUnique({
      where: { clave: datos.rolClave },
      select: { id: true, clave: true, permisos: { select: { permiso: { select: { clave: true } } } } },
    });

    if (!rol) {
      throw new ErrorNegocio('ROL_DESCONOCIDO', 'El rol indicado no existe.');
    }

    // Separacion de funciones, evaluada AL ASIGNAR (RNFS-007).
    this.verificarSeparacionFunciones(
      rol.permisos.map((p) => p.permiso.clave).filter(ES_PERMISO),
    );

    const programa = datos.programaClave
      ? await this.prisma.programa.findUnique({
          where: { clave: datos.programaClave },
          select: { id: true },
        })
      : null;

    if (datos.programaClave && !programa) {
      throw new ErrorNegocio('PROGRAMA_DESCONOCIDO', 'El programa indicado no existe.');
    }

    const hash = await this.contrasenas.derivar(datos.contrasenaInicial);

    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          idPublico: ulid(),
          correo: datos.correo,
          contrasenaHash: hash,
          perfil: {
            create: {
              nombre: datos.nombre,
              apellidoPaterno: datos.apellidoPaterno,
              apellidoMaterno: datos.apellidoMaterno ?? null,
              matricula: datos.matricula ?? null,
              programaId: programa?.id ?? null,
            },
          },
          asignacionesRol: {
            create: {
              idPublico: ulid(),
              rolId: rol.id,
              desdeEl: new Date(),
              motivo: datos.motivo,
              autorId: actor.usuarioId,
              // Revision semestral por omision (D-08). Una asignacion sin
              // fecha de revision es la que acaba acumulandose durante anos.
              revisarEl: new Date(Date.now() + 182 * 86_400_000),
            },
          },
        },
        select: { id: true, idPublico: true, correo: true },
      });

      await this.auditoria.registrar(tx, {
        accion: 'usuario.alta',
        tipoRecurso: 'usuario',
        recursoId: usuario.idPublico,
        resultado: 'exito',
        motivo: datos.motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        // La contrasena inicial no aparece: el saneador del servicio de
        // auditoria la filtraria igualmente, pero es mejor no pasarla.
        despues: { correo: usuario.correo, rol: rol.clave, programa: datos.programaClave ?? null },
      });

      return { id: usuario.idPublico, correo: usuario.correo };
    });
  }

  /**
   * Activa o desactiva una cuenta (RF-013).
   *
   * Al desactivar se revocan las sesiones: si no, la cuenta seguiria operando
   * hasta que su cookie expirara por su cuenta, que es justo lo contrario de
   * lo que "desactivar" significa.
   */
  async cambiarEstado(actor: Actor, idPublico: string, activo: boolean, motivo: string) {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { idPublico },
        select: { id: true, idPublico: true, correo: true, activo: true },
      });

      if (!usuario) throw new AccesoDenegado();

      // Un administrador no puede desactivarse a si mismo: es la via mas comun
      // de quedarse sin ningun administrador operativo en el sistema.
      if (usuario.id === actor.usuarioId && !activo) {
        throw new ErrorNegocio(
          'AUTODESACTIVACION',
          'No puedes desactivar tu propia cuenta.',
          HttpStatus.CONFLICT,
        );
      }

      const actualizado = await tx.usuario.update({
        where: { id: usuario.id },
        data: { activo, desactivadoEl: activo ? null : new Date() },
        select: { activo: true },
      });

      if (!activo) {
        await tx.sesion.updateMany({
          where: { usuarioId: usuario.id, revocadaEl: null },
          data: { revocadaEl: new Date(), motivoRevocacion: 'cuenta-desactivada' },
        });
        await tx.usuario.update({
          where: { id: usuario.id },
          data: { sesionesValidasDesde: new Date() },
        });
      }

      await this.auditoria.registrar(tx, {
        accion: activo ? 'usuario.modificacion' : 'usuario.desactivacion',
        tipoRecurso: 'usuario',
        recursoId: usuario.idPublico,
        resultado: 'exito',
        motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        antes: { activo: usuario.activo },
        despues: { activo: actualizado.activo },
      });

      return { id: usuario.idPublico, activo: actualizado.activo };
    });
  }

  /**
   * Asigna un rol con vigencia y motivo (RF-071).
   *
   * Aqui vive la comprobacion mas importante del modulo: la separacion de
   * funciones se evalua sobre los permisos **acumulados** del usuario, no
   * solo sobre los del rol que se esta anadiendo. Dos roles inocuos por
   * separado pueden sumar una combinacion prohibida, y ese es exactamente el
   * camino por el que estas cosas se cuelan.
   */
  async asignarRol(
    actor: Actor,
    idPublicoUsuario: string,
    rolClave: string,
    motivo: string,
    hastaEl: Date | null,
  ) {
    const [usuario, rol] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { idPublico: idPublicoUsuario },
        select: { id: true, idPublico: true, correo: true },
      }),
      this.prisma.rol.findUnique({
        where: { clave: rolClave },
        select: {
          id: true,
          clave: true,
          permisos: { select: { permiso: { select: { clave: true } } } },
        },
      }),
    ]);

    if (!usuario) throw new AccesoDenegado();
    if (!rol) throw new ErrorNegocio('ROL_DESCONOCIDO', 'El rol indicado no existe.');

    // Escalada de privilegios por la puerta de atras: quien administra roles
    // no debe poder otorgarse capacidades a si mismo. SC-LAB-001 escenario 4
    // lista "otorgamiento de privilegios permanentes al atacante" como el
    // impacto principal de comprometer una cuenta administrativa.
    if (usuario.id === actor.usuarioId) {
      throw new ErrorNegocio(
        'AUTOASIGNACION',
        'No puedes asignarte roles a ti mismo. Debe hacerlo otro administrador.',
        HttpStatus.CONFLICT,
      );
    }

    const permisosActuales = await this.permisosVigentesDe(usuario.id);
    const permisosDelRol = rol.permisos.map((p) => p.permiso.clave).filter(ES_PERMISO);

    this.verificarSeparacionFunciones([...permisosActuales, ...permisosDelRol]);

    return this.prisma.$transaction(async (tx) => {
      const asignacion = await tx.asignacionRol.create({
        data: {
          idPublico: ulid(),
          usuarioId: usuario.id,
          rolId: rol.id,
          desdeEl: new Date(),
          hastaEl,
          motivo,
          autorId: actor.usuarioId,
          revisarEl: new Date(Date.now() + 182 * 86_400_000),
        },
        select: { idPublico: true, desdeEl: true, hastaEl: true },
      });

      await this.auditoria.registrar(tx, {
        accion: 'rol.asignacion',
        tipoRecurso: 'asignacion-rol',
        recursoId: asignacion.idPublico,
        resultado: 'exito',
        motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        despues: {
          usuario: usuario.idPublico,
          rol: rol.clave,
          desdeEl: asignacion.desdeEl,
          hastaEl: asignacion.hastaEl,
        },
      });

      return {
        id: asignacion.idPublico,
        rol: rol.clave,
        desdeEl: asignacion.desdeEl.toISOString(),
        hastaEl: asignacion.hastaEl?.toISOString() ?? null,
      };
    });
  }

  async revocarRol(actor: Actor, idPublicoAsignacion: string, motivo: string) {
    return this.prisma.$transaction(async (tx) => {
      const asignacion = await tx.asignacionRol.findUnique({
        where: { idPublico: idPublicoAsignacion },
        select: {
          id: true,
          idPublico: true,
          revocadaEl: true,
          usuario: { select: { id: true, idPublico: true } },
          rol: { select: { clave: true } },
        },
      });

      if (!asignacion || asignacion.revocadaEl) throw new AccesoDenegado();

      await tx.asignacionRol.update({
        where: { id: asignacion.id },
        data: { revocadaEl: new Date() },
      });

      // La revocacion surte efecto en la siguiente peticion sin tocar las
      // sesiones: `permisosVigentes` filtra por `revocadaEl` en cada llamada.
      // No hay ventana en la que el permiso revocado siga funcionando.
      await this.auditoria.registrar(tx, {
        accion: 'rol.revocacion',
        tipoRecurso: 'asignacion-rol',
        recursoId: asignacion.idPublico,
        resultado: 'exito',
        motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        antes: { usuario: asignacion.usuario.idPublico, rol: asignacion.rol.clave, activa: true },
        despues: { activa: false },
      });

      return { id: asignacion.idPublico, revocada: true };
    });
  }

  private async permisosVigentesDe(usuarioId: string): Promise<Permiso[]> {
    const ahora = new Date();
    const asignaciones = await this.prisma.asignacionRol.findMany({
      where: {
        usuarioId,
        revocadaEl: null,
        desdeEl: { lte: ahora },
        OR: [{ hastaEl: null }, { hastaEl: { gt: ahora } }],
      },
      select: { rol: { select: { permisos: { select: { permiso: { select: { clave: true } } } } } } },
    });

    return asignaciones.flatMap((a) =>
      a.rol.permisos.map((p) => p.permiso.clave).filter(ES_PERMISO),
    );
  }

  /**
   * Rechaza combinaciones de permisos incompatibles (RNFS-007).
   *
   * Es el control preventivo que cierra el escenario 5 de SC-LAB-001. Alli el
   * jefe de carrera se asigna un grupo, entra a calificaciones —donde la
   * verificacion responde correctamente que SI esta autorizado— altera notas y
   * revierte la asignacion. El ataque "no rompe ningun control, los usa".
   *
   * Contra eso la prevencion casi no tiene margen, porque asignar profesores
   * *es* su trabajo. Lo que si se puede impedir es **encadenarlo**: que la
   * misma cuenta pueda asignar y calificar. De ahi que esta comprobacion viva
   * en el momento de otorgar el permiso y no en el de usarlo — si se evaluara
   * al usarlo, existiria una cuenta capaz de hacerlo y el control dependeria
   * de que nadie lo intentara.
   */
  private verificarSeparacionFunciones(permisos: Permiso[]): void {
    const conflictos = detectarConflictosSeparacion(permisos);
    if (conflictos.length === 0) return;

    const detalle = conflictos
      .map((c) => `${c.permisoA} + ${c.permisoB}`)
      .join('; ');

    throw new ErrorNegocio(
      'SEPARACION_FUNCIONES',
      `La combinacion de permisos viola la separacion de funciones: ${detalle}. ` +
        'Estas capacidades deben repartirse entre cuentas distintas.',
      HttpStatus.CONFLICT,
    );
  }
}
