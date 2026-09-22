import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import type { BloqueHorario, CrearGrupo } from '@securecampus/contracts';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { AccesoDenegado, ErrorNegocio } from '../comun/excepciones.filter.js';
import { PrismaService } from '../comun/prisma.service.js';

@Injectable()
export class GruposService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Lista los grupos visibles para el actor.
   *
   * El filtro se construye a partir del actor, **no** de un parametro de
   * consulta. Si el programa o el profesor vinieran de la query, cambiar un
   * valor en la URL bastaria para ver los grupos de otra carrera — seria el
   * caso de Maria aplicado a un listado.
   */
  async listarPara(actor: Actor, periodoClave?: string) {
    const filtro: Prisma.GrupoWhereInput = {};

    if (actor.permisos.has('grupo:crear') && actor.programaId) {
      // Jefe de carrera: los de su programa.
      filtro.programaId = actor.programaId;
    } else if (actor.permisos.has('calificacion:crear')) {
      // Profesor: solo aquellos con asignacion vigente suya.
      const ahora = new Date();
      filtro.asignaciones = {
        some: {
          profesorId: actor.usuarioId,
          desdeEl: { lte: ahora },
          OR: [{ hastaEl: null }, { hastaEl: { gt: ahora } }],
        },
      };
    } else if (!actor.permisos.has('usuario:leer')) {
      // Sin ninguna de las relaciones anteriores y sin alcance administrativo,
      // el listado es vacio. Deny by default aplicado a una consulta: la
      // ausencia de criterio no produce "todos", produce "ninguno".
      return [];
    }

    if (periodoClave) filtro.periodo = { clave: periodoClave };

    const grupos = await this.prisma.grupo.findMany({
      where: filtro,
      orderBy: [{ periodo: { inicia: 'desc' } }, { clave: 'asc' }],
      select: {
        idPublico: true,
        clave: true,
        cupo: true,
        materia: { select: { clave: true, nombre: true } },
        periodo: { select: { clave: true, estado: true } },
        aula: { select: { clave: true, edificio: true } },
        programa: { select: { clave: true, nombre: true } },
        horario: { select: { dia: true, inicioMin: true, finMin: true } },
        _count: { select: { inscripciones: true } },
        asignaciones: {
          where: { hastaEl: null },
          select: { profesor: { select: { idPublico: true, correo: true } } },
          take: 1,
        },
      },
    });

    return grupos.map((g) => ({
      id: g.idPublico,
      clave: g.clave,
      cupo: g.cupo,
      inscritos: g._count.inscripciones,
      materia: g.materia,
      periodo: g.periodo,
      aula: g.aula,
      programa: g.programa,
      horario: g.horario.map((b) => ({
        dia: b.dia,
        horaInicio: aHora(b.inicioMin),
        horaFin: aHora(b.finMin),
      })),
      profesor: g.asignaciones[0]?.profesor ?? null,
    }));
  }

  /**
   * Crea un grupo (RF-023).
   *
   * El `programaId` sale de `actor.programaId` y no del cuerpo: el esquema
   * `esquemaCrearGrupo` ni siquiera lo declara, asi que enviarlo en el
   * formulario no tiene ningun efecto.
   */
  async crear(actor: Actor, datos: CrearGrupo, motivo: string) {
    if (!actor.programaId) {
      throw new ErrorNegocio(
        'SIN_PROGRAMA',
        'Tu cuenta no esta adscrita a ningun programa academico.',
        HttpStatus.CONFLICT,
      );
    }

    const [materia, periodo, aula] = await Promise.all([
      this.prisma.materia.findUnique({
        where: { idPublico: datos.materiaId },
        select: { id: true, programaId: true, clave: true },
      }),
      this.prisma.periodo.findUnique({
        where: { idPublico: datos.periodoId },
        select: { id: true, clave: true, estado: true },
      }),
      this.prisma.aula.findUnique({
        where: { idPublico: datos.aulaId },
        select: { id: true, clave: true, capacidad: true },
      }),
    ]);

    if (!materia || !periodo || !aula) {
      throw new ErrorNegocio('CATALOGO_DESCONOCIDO', 'Materia, periodo o aula inexistente.');
    }

    // La materia tambien tiene que ser del programa del jefe. Sin esta
    // comprobacion podria crear un grupo "de su programa" para una materia
    // ajena, que es la misma fuga por otra puerta.
    if (materia.programaId !== actor.programaId) {
      throw new AccesoDenegado();
    }

    if (periodo.estado !== 'abierto') {
      throw new ErrorNegocio(
        'PERIODO_CERRADO',
        'No se pueden crear grupos en un periodo cerrado. ' +
          'Un cambio retroactivo exige autorizacion extraordinaria.',
        HttpStatus.CONFLICT,
      );
    }

    if (datos.cupo > aula.capacidad) {
      throw new ErrorNegocio(
        'CUPO_EXCEDE_AULA',
        `El cupo (${datos.cupo}) excede la capacidad del aula (${aula.capacidad}).`,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const grupo = await tx.grupo.create({
          data: {
            idPublico: ulid(),
            clave: datos.clave,
            programaId: actor.programaId!,
            materiaId: materia.id,
            periodoId: periodo.id,
            aulaId: aula.id,
            cupo: datos.cupo,
            horario: {
              create: datos.horario.map((b: BloqueHorario) => ({
                dia: b.dia,
                inicioMin: aMinutos(b.horaInicio),
                finMin: aMinutos(b.horaFin),
              })),
            },
          },
          select: { id: true, idPublico: true, clave: true },
        });

        await this.auditoria.registrar(tx, {
          accion: 'grupo.alta',
          tipoRecurso: 'grupo',
          recursoId: grupo.idPublico,
          resultado: 'exito',
          motivo,
          actorId: actor.usuarioId,
          actorCorreo: actor.correo,
          despues: {
            clave: grupo.clave,
            materia: materia.clave,
            periodo: periodo.clave,
            aula: aula.clave,
            cupo: datos.cupo,
            horario: datos.horario,
          },
        });

        return { id: grupo.idPublico, clave: grupo.clave };
      });
    } catch (error) {
      throw traducirConflictoDeBaseDeDatos(error);
    }
  }
}

/**
 * Traduce los errores de las restricciones de Postgres a errores de negocio.
 *
 * Las restricciones de exclusion detectan los choques de aula sin condicion de
 * carrera, pero su mensaje nativo menciona la tabla, la restriccion y los
 * valores. Dejarlo pasar violaria RNFS-050, asi que se traduce a un codigo
 * propio y el detalle tecnico se queda en el log.
 */
function traducirConflictoDeBaseDeDatos(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new ErrorNegocio(
        'CLAVE_DUPLICADA',
        'Ya existe un grupo con esa clave en el periodo indicado.',
        HttpStatus.CONFLICT,
      );
    }
  }

  const mensaje = error instanceof Error ? error.message : String(error);
  if (mensaje.includes('bloque_horario_sin_choque_aula')) {
    return new ErrorNegocio(
      'CHOQUE_HORARIO_AULA',
      'El aula ya esta ocupada por otro grupo en ese horario.',
      HttpStatus.CONFLICT,
    );
  }
  if (mensaje.includes('bloque_horario_sin_traslape_interno')) {
    return new ErrorNegocio(
      'CHOQUE_HORARIO_GRUPO',
      'Los bloques de horario del grupo se traslapan entre si.',
      HttpStatus.CONFLICT,
    );
  }

  return error instanceof Error ? error : new Error(mensaje);
}

function aMinutos(hora: string): number {
  const [h = '0', m = '0'] = hora.split(':');
  return Number(h) * 60 + Number(m);
}

function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
