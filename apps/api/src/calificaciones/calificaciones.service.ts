import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ulid } from 'ulid';
import { transicionPermitida, type EstadoCalificacion } from '@securecampus/contracts';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { AccesoDenegado, ErrorNegocio } from '../comun/excepciones.filter.js';
import { PrismaService } from '../comun/prisma.service.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';

/**
 * Calificaciones (RF-040 a RF-046).
 *
 * El activo de mayor valor institucional (SC-LAB-001 §5.5): "un dato personal
 * filtrado es un dano grave, pero el titulo academico sigue siendo valido; una
 * calificacion alterada sin rastro invalida la certificacion misma, que es lo
 * unico que la universidad realmente emite".
 *
 * Tres controles lo sostienen, y ninguno sustituye a los otros:
 *
 *   1. **Autorizacion por relacion** — la asignacion docente vigente, no el
 *      rol profesor. La resuelve `grupoAsignadoVigente` antes de llegar aqui.
 *   2. **Maquina de estados** — una calificacion publicada no se actualiza.
 *   3. **Historial append-only + notificacion** — porque contra un profesor
 *      legitimamente autorizado la prevencion no alcanza, y lo unico que
 *      queda es la trazabilidad y que el afectado se entere.
 */
@Injectable()
export class CalificacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Calificaciones del propio estudiante (RF-040). Nunca en borrador. */
  async misCalificaciones(actor: Actor) {
    const calificaciones = await this.prisma.calificacion.findMany({
      // El filtro es `estudianteId` de la SESION. No hay parametro que
      // sustituirlo: el caso de Maria no es representable en esta consulta.
      where: { estudianteId: actor.usuarioId, estado: { in: ['publicado', 'corregido'] } },
      orderBy: { actualizadaEl: 'desc' },
      select: {
        idPublico: true,
        valor: true,
        estado: true,
        versionActual: true,
        publicadaEl: true,
        actualizadaEl: true,
        grupo: {
          select: {
            clave: true,
            materia: { select: { clave: true, nombre: true } },
            periodo: { select: { clave: true } },
          },
        },
      },
    });

    return calificaciones.map((c) => ({
      id: c.idPublico,
      valor: Number(c.valor),
      estado: c.estado,
      version: c.versionActual,
      publicadaEl: c.publicadaEl?.toISOString() ?? null,
      actualizadaEl: c.actualizadaEl.toISOString(),
      grupo: c.grupo,
    }));
  }

  /** Lista de captura del grupo (RF-041): inscritos y su calificacion actual. */
  async listaDeCaptura(grupoId: string) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { grupoId, bajaEl: null },
      orderBy: [{ estudiante: { perfil: { apellidoPaterno: 'asc' } } }],
      select: {
        estudiante: {
          select: {
            idPublico: true,
            correo: true,
            perfil: {
              select: { nombre: true, apellidoPaterno: true, apellidoMaterno: true, matricula: true },
            },
          },
        },
      },
    });

    const calificaciones = await this.prisma.calificacion.findMany({
      where: { grupoId },
      select: {
        idPublico: true,
        valor: true,
        estado: true,
        versionActual: true,
        estudiante: { select: { idPublico: true } },
      },
    });

    const porEstudiante = new Map(calificaciones.map((c) => [c.estudiante.idPublico, c]));

    return inscripciones.map((i) => {
      const calificacion = porEstudiante.get(i.estudiante.idPublico);
      return {
        estudiante: {
          id: i.estudiante.idPublico,
          matricula: i.estudiante.perfil?.matricula ?? null,
          nombre: i.estudiante.perfil
            ? `${i.estudiante.perfil.apellidoPaterno} ${i.estudiante.perfil.apellidoMaterno ?? ''} ${i.estudiante.perfil.nombre}`.trim()
            : i.estudiante.correo,
        },
        calificacion: calificacion
          ? {
              id: calificacion.idPublico,
              valor: Number(calificacion.valor),
              estado: calificacion.estado,
              version: calificacion.versionActual,
            }
          : null,
      };
    });
  }

  /**
   * Captura o actualiza calificaciones en borrador (RF-042).
   *
   * Solo toca lo que esta en `borrador`. Una calificacion publicada que llegue
   * en el lote se rechaza: la unica salida de `publicado` es el flujo de
   * correccion, que exige otro permiso y motivo.
   */
  async capturarLote(
    actor: Actor,
    grupo: { id: string; idPublico: string },
    entradas: readonly { estudianteId: string; valor: number }[],
  ) {
    const estudiantes = await this.prisma.usuario.findMany({
      where: { idPublico: { in: entradas.map((e) => e.estudianteId) } },
      select: { id: true, idPublico: true },
    });

    const porIdPublico = new Map(estudiantes.map((e) => [e.idPublico, e.id]));

    // Inscripcion vigente: un profesor con asignacion valida sobre el grupo
    // tampoco puede calificar a alguien que no esta inscrito en el.
    const inscritos = await this.prisma.inscripcion.findMany({
      where: { grupoId: grupo.id, bajaEl: null },
      select: { estudianteId: true },
    });
    const idsInscritos = new Set(inscritos.map((i) => i.estudianteId));

    return this.prisma.$transaction(async (tx) => {
      const resultados: { estudianteId: string; estado: string; version: number }[] = [];

      for (const entrada of entradas) {
        const estudianteId = porIdPublico.get(entrada.estudianteId);
        if (!estudianteId || !idsInscritos.has(estudianteId)) {
          throw new AccesoDenegado();
        }

        const existente = await tx.calificacion.findUnique({
          where: { grupoId_estudianteId: { grupoId: grupo.id, estudianteId } },
          select: { id: true, valor: true, estado: true, versionActual: true },
        });

        const estadoActual = (existente?.estado ?? 'borrador') as EstadoCalificacion;

        if (existente && !transicionPermitida(estadoActual, 'borrador')) {
          throw new ErrorNegocio(
            'CALIFICACION_NO_EDITABLE',
            'Una calificacion publicada no se edita directamente. ' +
              'Requiere el flujo de correccion, con permiso y motivo.',
            HttpStatus.CONFLICT,
          );
        }

        const version = (existente?.versionActual ?? 0) + 1;

        const calificacion = existente
          ? await tx.calificacion.update({
              where: { id: existente.id },
              data: { valor: new Prisma.Decimal(entrada.valor), versionActual: version },
              select: { id: true, idPublico: true },
            })
          : await tx.calificacion.create({
              data: {
                idPublico: ulid(),
                grupoId: grupo.id,
                estudianteId,
                valor: new Prisma.Decimal(entrada.valor),
                estado: 'borrador',
                versionActual: 1,
              },
              select: { id: true, idPublico: true },
            });

        await tx.versionCalificacion.create({
          data: {
            calificacionId: calificacion.id,
            version,
            valorAnterior: existente?.valor ?? null,
            valorNuevo: new Prisma.Decimal(entrada.valor),
            estadoAnterior: existente?.estado ?? null,
            estadoNuevo: 'borrador',
            autorId: actor.usuarioId,
          },
        });

        resultados.push({ estudianteId: entrada.estudianteId, estado: 'borrador', version });
      }

      // Un solo evento para el lote, no uno por alumno: la bitacora debe
      // reflejar la operacion tal como ocurrio. Treinta eventos separados
      // esconderian que fue una sola captura.
      await this.auditoria.registrar(tx, {
        accion: 'calificacion.captura',
        tipoRecurso: 'grupo',
        recursoId: grupo.idPublico,
        resultado: 'exito',
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        despues: { capturadas: resultados.length, detalle: resultados },
      });

      return { capturadas: resultados.length, resultados };
    });
  }

  /**
   * Publica calificaciones en borrador (RF-043).
   *
   * A partir de aqui son un hecho oficial: el estudiante las ve y cualquier
   * cambio posterior exige el flujo de correccion.
   */
  async publicar(
    actor: Actor,
    grupo: { id: string; idPublico: string },
    calificacionIds: readonly string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const calificaciones = await tx.calificacion.findMany({
        where: { idPublico: { in: [...calificacionIds] }, grupoId: grupo.id },
        select: { id: true, idPublico: true, estado: true, valor: true, versionActual: true },
      });

      // Si alguna no pertenece al grupo, se rechaza el lote completo en vez de
      // publicar las validas: un lote parcialmente aplicado deja un estado que
      // nadie pidio y que es dificil de revertir.
      if (calificaciones.length !== calificacionIds.length) {
        throw new AccesoDenegado();
      }

      const publicables = calificaciones.filter((c) =>
        transicionPermitida(c.estado as EstadoCalificacion, 'publicado'),
      );

      if (publicables.length !== calificaciones.length) {
        throw new ErrorNegocio(
          'TRANSICION_INVALIDA',
          'Alguna de las calificaciones no esta en borrador.',
          HttpStatus.CONFLICT,
        );
      }

      const ahora = new Date();

      for (const calificacion of publicables) {
        const version = calificacion.versionActual + 1;

        await tx.calificacion.update({
          where: { id: calificacion.id },
          data: { estado: 'publicado', publicadaEl: ahora, versionActual: version },
        });

        await tx.versionCalificacion.create({
          data: {
            calificacionId: calificacion.id,
            version,
            valorAnterior: calificacion.valor,
            valorNuevo: calificacion.valor,
            estadoAnterior: calificacion.estado,
            estadoNuevo: 'publicado',
            autorId: actor.usuarioId,
          },
        });
      }

      await this.auditoria.registrar(tx, {
        accion: 'calificacion.publicacion',
        tipoRecurso: 'grupo',
        recursoId: grupo.idPublico,
        resultado: 'exito',
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        despues: { publicadas: publicables.map((c) => c.idPublico) },
      });

      return { publicadas: publicables.length };
    });
  }

  /**
   * Corrige una calificacion publicada (RF-044).
   *
   * Es la operacion mas sensible del sistema y por eso acumula controles:
   * permiso propio (`calificacion:corregir`, incompatible con capturar por
   * RNFS-007), motivo obligatorio, version previa conservada, auditoria en la
   * misma transaccion y **notificacion al estudiante**.
   *
   * La notificacion no es un parametro que el solicitante pueda desactivar. Es
   * el control que SC-LAB-002 escenario C llama "el de mayor valor por su
   * costo... el unico control que funciona cuando el atacante esta formalmente
   * autorizado". Solo funciona si no se puede silenciar.
   */
  async corregir(
    actor: Actor,
    calificacion: {
      id: string;
      idPublico: string;
      estado: string;
      valor: Prisma.Decimal;
      versionActual: number;
      estudianteId: string;
      grupoId: string;
    },
    valorNuevo: number,
    motivo: string,
  ) {
    if (!transicionPermitida(calificacion.estado as EstadoCalificacion, 'corregido')) {
      throw new ErrorNegocio(
        'TRANSICION_INVALIDA',
        'Solo se corrige una calificacion publicada.',
        HttpStatus.CONFLICT,
      );
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const version = calificacion.versionActual + 1;

      await tx.calificacion.update({
        where: { id: calificacion.id },
        data: {
          valor: new Prisma.Decimal(valorNuevo),
          estado: 'corregido',
          versionActual: version,
        },
      });

      await tx.versionCalificacion.create({
        data: {
          calificacionId: calificacion.id,
          version,
          valorAnterior: calificacion.valor,
          valorNuevo: new Prisma.Decimal(valorNuevo),
          estadoAnterior: calificacion.estado,
          estadoNuevo: 'corregido',
          autorId: actor.usuarioId,
          motivo,
        },
      });

      await this.auditoria.registrar(tx, {
        accion: 'calificacion.correccion',
        tipoRecurso: 'calificacion',
        recursoId: calificacion.idPublico,
        resultado: 'exito',
        motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        antes: { valor: Number(calificacion.valor), estado: calificacion.estado },
        despues: { valor: valorNuevo, estado: 'corregido', version },
      });

      return { version, estudianteId: calificacion.estudianteId };
    });

    // Fuera de la transaccion a proposito: encolar la notificacion no debe
    // poder revertir una correccion ya consumada. Si el correo falla, BullMQ
    // reintenta; si se revirtiera la correccion, el estado quedaria
    // inconsistente con lo que el usuario vio.
    await this.notificaciones.encolar({
      destinatarioId: resultado.estudianteId,
      tipo: 'calificacion-corregida',
      canal: 'correo',
      titulo: 'Una calificacion tuya fue corregida',
      // El cuerpo NO incluye el valor anterior ni el nuevo: un correo viaja
      // por un canal que no controlamos. Quien reciba el aviso entra al
      // sistema a verlo (RF-091).
      cuerpo:
        'Una de tus calificaciones publicadas fue corregida. ' +
        'Consulta el detalle y el motivo en SecureCampus. ' +
        'Si no esperabas este cambio, comunicate con tu coordinacion.',
      claveIdempotencia: `calificacion-corregida:${calificacion.idPublico}:${resultado.version}`,
    });

    return { id: calificacion.idPublico, valor: valorNuevo, version: resultado.version };
  }

  /** Historial completo de versiones (RF-045). */
  async historial(calificacionId: string) {
    const versiones = await this.prisma.versionCalificacion.findMany({
      where: { calificacionId },
      orderBy: { version: 'desc' },
      select: {
        version: true,
        valorAnterior: true,
        valorNuevo: true,
        estadoAnterior: true,
        estadoNuevo: true,
        motivo: true,
        creadaEl: true,
      },
    });

    return versiones.map((v) => ({
      version: v.version,
      valorAnterior: v.valorAnterior === null ? null : Number(v.valorAnterior),
      valorNuevo: Number(v.valorNuevo),
      estadoAnterior: v.estadoAnterior,
      estadoNuevo: v.estadoNuevo,
      motivo: v.motivo,
      creadaEl: v.creadaEl.toISOString(),
    }));
  }
}
