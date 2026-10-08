import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import type { Permiso } from '@securecampus/contracts';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { AccesoDenegado, ErrorNegocio } from '../comun/excepciones.filter.js';
import { PrismaService } from '../comun/prisma.service.js';

/** Usuarios activos con una asignacion de rol vigente que otorga `permiso`. */
export function conPermisoVigente(permiso: Permiso): Prisma.UsuarioWhereInput {
  const ahora = new Date();
  return {
    activo: true,
    asignacionesRol: {
      some: {
        revocadaEl: null,
        desdeEl: { lte: ahora },
        OR: [{ hastaEl: null }, { hastaEl: { gt: ahora } }],
        rol: { permisos: { some: { permiso: { clave: permiso } } } },
      },
    },
  };
}

const SELECCION_PERSONA = {
  idPublico: true,
  correo: true,
  perfil: {
    select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true, matricula: true },
  },
} as const;

type Persona = Prisma.UsuarioGetPayload<{ select: typeof SELECCION_PERSONA }>;

function aPersona(u: Persona) {
  return {
    id: u.idPublico,
    correo: u.correo,
    matricula: u.perfil?.matricula ?? null,
    nombre: u.perfil
      ? `${u.perfil.apellidoPaterno} ${u.perfil.apellidoMaterno ?? ''} ${u.perfil.nombre}`.replace(/\s+/g, ' ').trim()
      : u.correo,
  };
}

/**
 * Inscripciones y catalogos de personas del programa del jefe de carrera.
 *
 * El alcance sale siempre de `actor.programaId`. Ningun metodo recibe un
 * programa como parametro: si lo recibiera, cambiar un campo alcanzaria a
 * otra carrera (SC-LAB-001 escenario 5, vulnerabilidad c).
 */
@Injectable()
export class InscripcionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Profesores que pueden recibir una asignacion: los que pueden capturar. */
  async profesoresDelPrograma(actor: Actor) {
    if (!actor.programaId) return [];
    const profesores = await this.prisma.usuario.findMany({
      where: {
        ...conPermisoVigente('calificacion:crear'),
        perfil: { programaId: actor.programaId },
        id: { not: actor.usuarioId },
      },
      orderBy: { perfil: { apellidoPaterno: 'asc' } },
      select: SELECCION_PERSONA,
    });
    return profesores.map(aPersona);
  }

  async estudiantesDelPrograma(actor: Actor) {
    if (!actor.programaId) return [];
    const ahora = new Date();
    const estudiantes = await this.prisma.usuario.findMany({
      where: {
        activo: true,
        perfil: { programaId: actor.programaId },
        asignacionesRol: {
          some: {
            revocadaEl: null,
            desdeEl: { lte: ahora },
            OR: [{ hastaEl: null }, { hastaEl: { gt: ahora } }],
            rol: { clave: 'estudiante' },
          },
        },
      },
      orderBy: { perfil: { apellidoPaterno: 'asc' } },
      select: SELECCION_PERSONA,
    });
    return estudiantes.map(aPersona);
  }

  async listar(grupoId: string) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { grupoId, bajaEl: null },
      orderBy: { estudiante: { perfil: { apellidoPaterno: 'asc' } } },
      select: { idPublico: true, creadaEl: true, estudiante: { select: SELECCION_PERSONA } },
    });
    return inscripciones.map((i) => ({
      id: i.idPublico,
      creadaEl: i.creadaEl.toISOString(),
      estudiante: aPersona(i.estudiante),
    }));
  }

  async inscribir(
    actor: Actor,
    grupo: { id: string; idPublico: string; programaId: string },
    estudianteIdPublico: string,
  ) {
    const ahora = new Date();
    const estudiante = await this.prisma.usuario.findFirst({
      where: {
        idPublico: estudianteIdPublico,
        activo: true,
        perfil: { programaId: grupo.programaId },
        asignacionesRol: {
          some: {
            revocadaEl: null,
            desdeEl: { lte: ahora },
            OR: [{ hastaEl: null }, { hastaEl: { gt: ahora } }],
            rol: { clave: 'estudiante' },
          },
        },
      },
      select: { id: true, idPublico: true, correo: true },
    });

    // Inexistente, inactivo, de otro programa o sin rol de estudiante:
    // la misma respuesta para no revelar cual de las cuatro fue.
    if (!estudiante) throw new AccesoDenegado();

    return this.prisma.$transaction(async (tx) => {
      const { cupo, _count } = await tx.grupo.findUniqueOrThrow({
        where: { id: grupo.id },
        select: { cupo: true, _count: { select: { inscripciones: { where: { bajaEl: null } } } } },
      });

      const existente = await tx.inscripcion.findUnique({
        where: { grupoId_estudianteId: { grupoId: grupo.id, estudianteId: estudiante.id } },
        select: { id: true, idPublico: true, bajaEl: true },
      });

      if (existente && !existente.bajaEl) {
        throw new ErrorNegocio(
          'YA_INSCRITO',
          'El estudiante ya esta inscrito en este grupo.',
          HttpStatus.CONFLICT,
        );
      }

      if (_count.inscripciones >= cupo) {
        throw new ErrorNegocio('CUPO_LLENO', 'El grupo no tiene cupo disponible.', HttpStatus.CONFLICT);
      }

      // Una baja previa se reactiva en la misma fila: la restriccion unica
      // grupo-estudiante lo exige, y la bitacora conserva ambos eventos.
      const inscripcion = existente
        ? await tx.inscripcion.update({
            where: { id: existente.id },
            data: { bajaEl: null },
            select: { idPublico: true },
          })
        : await tx.inscripcion.create({
            data: { idPublico: ulid(), grupoId: grupo.id, estudianteId: estudiante.id },
            select: { idPublico: true },
          });

      await this.auditoria.registrar(tx, {
        accion: 'inscripcion.alta',
        tipoRecurso: 'inscripcion',
        recursoId: inscripcion.idPublico,
        resultado: 'exito',
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        despues: {
          grupo: grupo.idPublico,
          estudiante: estudiante.correo,
          reactivada: Boolean(existente),
        },
      });

      return { id: inscripcion.idPublico };
    });
  }

  async baja(
    actor: Actor,
    grupo: { id: string; idPublico: string },
    inscripcionIdPublico: string,
    motivo: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const inscripcion = await tx.inscripcion.findFirst({
        where: { idPublico: inscripcionIdPublico, grupoId: grupo.id, bajaEl: null },
        select: { id: true, idPublico: true, estudiante: { select: { correo: true } } },
      });
      if (!inscripcion) throw new AccesoDenegado();

      const ahora = new Date();
      await tx.inscripcion.update({ where: { id: inscripcion.id }, data: { bajaEl: ahora } });

      await this.auditoria.registrar(tx, {
        accion: 'inscripcion.baja',
        tipoRecurso: 'inscripcion',
        recursoId: inscripcion.idPublico,
        resultado: 'exito',
        motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        despues: { grupo: grupo.idPublico, estudiante: inscripcion.estudiante.correo, bajaEl: ahora },
      });

      return { id: inscripcion.idPublico, bajaEl: ahora.toISOString() };
    });
  }
}
