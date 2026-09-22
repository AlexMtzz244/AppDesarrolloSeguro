import { HttpStatus, Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { AccesoDenegado, ErrorNegocio } from '../comun/excepciones.filter.js';
import { PrismaService } from '../comun/prisma.service.js';

/**
 * Asignacion docente versionada (RF-030 a RF-032).
 *
 * # Por que este modulo existe aparte
 *
 * Porque el dato que produce es un **activo del que depende un control**, no
 * un registro administrativo mas. SC-LAB-001 §5.5 lo formula como regla
 * general: "si un control se apoya en un dato, ese dato hereda la criticidad
 * del control, y protegerlo deja de ser opcional".
 *
 * La verificacion de calificaciones pregunta "¿este profesor tiene asignacion
 * vigente sobre este grupo?". Quien pueda responder que si a voluntad no
 * necesita vulnerar nada del modulo de calificaciones: lo apaga desde aqui.
 *
 * # Por que no hay metodo `actualizar`
 *
 * Es la decision central. Cambiar de profesor **cierra** la vigencia actual y
 * **abre** una nueva fila; nunca sobrescribe. Asi el paso intermedio del
 * ataque —"me asigne, califique, reverti"— queda en el registro, que es el
 * unico control que lo ve.
 *
 * SC-LAB-002 escenario E: "Contra un actor que opera dentro de sus
 * atribuciones formales, la prevencion tiene poco margen sin quitarle su
 * funcion legitima. Lo que queda es que el paso intermedio sea visible,
 * atribuible e irreversible en el registro — y eso es deteccion, no
 * prevencion."
 */
@Injectable()
export class AsignacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async historial(grupoIdPublico: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { idPublico: grupoIdPublico },
      select: { id: true },
    });
    if (!grupo) throw new AccesoDenegado();

    const asignaciones = await this.prisma.asignacionDocente.findMany({
      where: { grupoId: grupo.id },
      orderBy: { version: 'desc' },
      select: {
        idPublico: true,
        version: true,
        desdeEl: true,
        hastaEl: true,
        motivo: true,
        creadaEl: true,
        profesor: { select: { idPublico: true, correo: true } },
        autor: { select: { idPublico: true, correo: true } },
      },
    });

    return asignaciones.map((a) => ({
      id: a.idPublico,
      version: a.version,
      desdeEl: a.desdeEl.toISOString(),
      hastaEl: a.hastaEl?.toISOString() ?? null,
      vigente: a.hastaEl === null,
      motivo: a.motivo,
      creadaEl: a.creadaEl.toISOString(),
      profesor: a.profesor,
      autor: a.autor,
    }));
  }

  /**
   * Crea una asignacion, cerrando la vigente si la hay.
   *
   * Todo ocurre en una transaccion: cerrar la anterior, abrir la nueva y
   * escribir el evento. Si algo falla, el grupo no queda ni sin profesor ni
   * con dos a la vez.
   */
  async asignar(
    actor: Actor,
    grupo: { id: string; idPublico: string; programaId: string; periodoId: string },
    profesorIdPublico: string,
    desde: Date,
    hasta: Date | null,
    motivo: string,
  ) {
    const profesor = await this.prisma.usuario.findUnique({
      where: { idPublico: profesorIdPublico },
      select: { id: true, idPublico: true, correo: true, activo: true },
    });

    if (!profesor?.activo) {
      throw new ErrorNegocio('PROFESOR_DESCONOCIDO', 'El profesor indicado no existe o esta inactivo.');
    }

    // Separacion de funciones aplicada al caso concreto (RNFS-007): el jefe no
    // puede asignarse a si mismo. La comprobacion general por permisos ya
    // impide que una cuenta acumule asignar y calificar, pero esta es mas
    // directa y cubre el caso en que la matriz de permisos se relaje.
    if (profesor.id === actor.usuarioId) {
      throw new ErrorNegocio(
        'AUTOASIGNACION_DOCENTE',
        'No puedes asignarte a ti mismo como profesor de un grupo. ' +
          'Debe hacerlo otra cuenta con la atribucion correspondiente.',
        HttpStatus.CONFLICT,
      );
    }

    await this.verificarChoquesDeHorario(profesor.id, grupo.id, grupo.periodoId);

    return this.prisma.$transaction(async (tx) => {
      const ahora = new Date();

      const vigente = await tx.asignacionDocente.findFirst({
        where: { grupoId: grupo.id, hastaEl: null },
        select: {
          id: true,
          idPublico: true,
          version: true,
          desdeEl: true,
          profesor: { select: { idPublico: true, correo: true } },
        },
      });

      if (vigente) {
        // Se CIERRA la vigencia anterior; no se borra ni se sobrescribe. La
        // fila sigue ahi con su `hastaEl`, y eso es lo que hace reconstruible
        // la historia meses despues.
        await tx.asignacionDocente.update({
          where: { id: vigente.id },
          data: { hastaEl: ahora },
        });
      }

      const ultima = await tx.asignacionDocente.findFirst({
        where: { grupoId: grupo.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const nueva = await tx.asignacionDocente.create({
        data: {
          idPublico: ulid(),
          grupoId: grupo.id,
          profesorId: profesor.id,
          version: (ultima?.version ?? 0) + 1,
          desdeEl: desde,
          hastaEl: hasta,
          autorId: actor.usuarioId,
          motivo,
        },
        select: { idPublico: true, version: true, desdeEl: true, hastaEl: true },
      });

      await this.auditoria.registrar(tx, {
        accion: 'asignacion-docente.alta',
        tipoRecurso: 'asignacion-docente',
        recursoId: nueva.idPublico,
        resultado: 'exito',
        motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        antes: vigente
          ? {
              version: vigente.version,
              profesor: vigente.profesor.correo,
              desdeEl: vigente.desdeEl,
              cerradaEl: ahora,
            }
          : null,
        despues: {
          grupo: grupo.idPublico,
          version: nueva.version,
          profesor: profesor.correo,
          desdeEl: nueva.desdeEl,
          hastaEl: nueva.hastaEl,
        },
      });

      return {
        id: nueva.idPublico,
        version: nueva.version,
        profesor: profesor.idPublico,
        desdeEl: nueva.desdeEl.toISOString(),
        hastaEl: nueva.hastaEl?.toISOString() ?? null,
      };
    });
  }

  /**
   * Cierra la asignacion vigente sin abrir otra: el grupo queda sin profesor.
   *
   * Esta es la operacion que, combinada con `asignar`, compone el patron
   * sospechoso "asignacion creada y revertida poco despues". La alerta
   * `asignacion-revertida-pronto` la detecta leyendo estas mismas filas.
   */
  async cerrar(
    actor: Actor,
    grupo: { id: string; idPublico: string },
    motivo: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const vigente = await tx.asignacionDocente.findFirst({
        where: { grupoId: grupo.id, hastaEl: null },
        select: {
          id: true,
          idPublico: true,
          version: true,
          desdeEl: true,
          profesor: { select: { correo: true } },
        },
      });

      if (!vigente) {
        throw new ErrorNegocio('SIN_ASIGNACION_VIGENTE', 'El grupo no tiene profesor asignado.');
      }

      const ahora = new Date();
      await tx.asignacionDocente.update({
        where: { id: vigente.id },
        data: { hastaEl: ahora },
      });

      await this.auditoria.registrar(tx, {
        accion: 'asignacion-docente.cierre',
        tipoRecurso: 'asignacion-docente',
        recursoId: vigente.idPublico,
        resultado: 'exito',
        motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        antes: { profesor: vigente.profesor.correo, desdeEl: vigente.desdeEl, hastaEl: null },
        despues: { hastaEl: ahora, duracionMinutos: minutosEntre(vigente.desdeEl, ahora) },
      });

      return { id: vigente.idPublico, cerradaEl: ahora.toISOString() };
    });
  }

  /**
   * Choques de horario y carga docente.
   *
   * Los choques de **aula** los impide una restriccion de exclusion en
   * Postgres, porque dos peticiones concurrentes pasarian ambas una
   * comprobacion previa. El choque de **profesor** no se puede expresar asi:
   * depende de la asignacion, que vive en otra tabla. Por eso se comprueba
   * aqui, y por eso esta anotado — es una asimetria consciente, no un olvido.
   */
  private async verificarChoquesDeHorario(
    profesorId: string,
    grupoId: string,
    periodoId: string,
  ): Promise<void> {
    const bloquesDelGrupo = await this.prisma.bloqueHorario.findMany({
      where: { grupoId },
      select: { dia: true, inicioMin: true, finMin: true },
    });

    if (bloquesDelGrupo.length === 0) return;

    const otrosGrupos = await this.prisma.asignacionDocente.findMany({
      where: {
        profesorId,
        grupoId: { not: grupoId },
        hastaEl: null,
        grupo: { periodoId },
      },
      select: {
        grupo: {
          select: {
            clave: true,
            horario: { select: { dia: true, inicioMin: true, finMin: true } },
          },
        },
      },
    });

    for (const asignacion of otrosGrupos) {
      for (const ocupado of asignacion.grupo.horario) {
        for (const propuesto of bloquesDelGrupo) {
          if (
            ocupado.dia === propuesto.dia &&
            ocupado.inicioMin < propuesto.finMin &&
            propuesto.inicioMin < ocupado.finMin
          ) {
            throw new ErrorNegocio(
              'CHOQUE_HORARIO_PROFESOR',
              `El profesor ya imparte el grupo ${asignacion.grupo.clave} en ese horario.`,
              HttpStatus.CONFLICT,
            );
          }
        }
      }
    }

    // Carga docente maxima. El limite concreto es una decision institucional
    // pendiente; 8 grupos por periodo es el valor por defecto seguro.
    const carga = await this.prisma.asignacionDocente.count({
      where: { profesorId, hastaEl: null, grupo: { periodoId } },
    });

    if (carga >= 8) {
      throw new ErrorNegocio(
        'CARGA_DOCENTE_EXCEDIDA',
        'El profesor alcanzo la carga maxima de grupos para este periodo.',
        HttpStatus.CONFLICT,
      );
    }

  }
}

function minutosEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}
