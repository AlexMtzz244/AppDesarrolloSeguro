import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ulid } from 'ulid';
import type { SeveridadAlerta, TipoAlerta } from '@securecampus/contracts';
import { PrismaService } from '../comun/prisma.service.js';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';

/**
 * Motor de alertas (RF-090).
 *
 * # Por que este modulo es el corazon del proyecto, y no la autorizacion
 *
 * Suena contraintuitivo despues de todo el peso puesto en el guard, pero es la
 * conclusion a la que llega SC-LAB-001 al analizar el escenario 5: hay un
 * ataque que **no rompe ningun control, los usa**. El jefe de carrera se
 * asigna un grupo —su trabajo *es* asignar profesores—, entra a
 * calificaciones donde la verificacion responde correctamente que si esta
 * autorizado, altera notas y revierte la asignacion. "El sistema queda en un
 * estado final consistente y sin rastro del paso intermedio."
 *
 * Contra un actor que opera dentro de sus atribuciones formales, la prevencion
 * tiene poco margen. Por eso aqui el control prioritario es **detectivo**, al
 * reves que en el resto del sistema.
 *
 * Las dos ultimas reglas de este archivo —`captura-inmediata-tras-asignacion`
 * y `asignacion-revertida-pronto`— son literalmente los dos controles que ese
 * escenario identifica como los unicos capaces de ver el paso intermedio.
 *
 * # Por que corre periodicamente y no en cada evento
 *
 * Porque los patrones que busca son temporales: "capturo *en la hora
 * siguiente* a ser asignado", "revirtio *poco despues* de crear". Ninguno se
 * puede evaluar en el instante en que ocurre el primer evento, porque el
 * segundo todavia no existe.
 *
 * Y una advertencia que SC-LAB-002 escenario E deja escrita: "Una bitacora que
 * nadie revisa no es un control, es un archivo." Estas reglas son la revision
 * automatizada; la humana sigue siendo necesaria.
 */
@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOKEN_ENTORNO) private readonly entorno: Entorno,
  ) {}

  private async emitir(
    tipo: TipoAlerta,
    severidad: SeveridadAlerta,
    detalle: string,
    claveIdempotencia: string,
    sujetoId?: string | null,
    eventoAuditoriaId?: string | null,
  ): Promise<void> {
    try {
      await this.prisma.alerta.create({
        data: {
          idPublico: ulid(),
          tipo,
          severidad,
          detalle: detalle.slice(0, 1000),
          claveIdempotencia,
          sujetoId: sujetoId ?? null,
          eventoAuditoriaId: eventoAuditoriaId ?? null,
        },
      });
      this.logger.warn({ tipo, severidad, detalle }, 'Alerta de seguridad emitida');
    } catch (error) {
      // Choque de `claveIdempotencia`: la alerta ya existe. Es el
      // comportamiento esperado al reevaluar la misma ventana, no un fallo.
      if ((error as { code?: string }).code !== 'P2002') {
        this.logger.error({ error, tipo }, 'No se pudo emitir la alerta');
      }
    }
  }

  /**
   * Rafagas de 403 y enumeracion.
   *
   * Es la firma de alguien recorriendo identificadores. SC-LAB-001 §3 la
   * describe para el caso de Maria: "el identificador es numerico y
   * consecutivo, asi que el ataque escala de un registro a toda la base".
   * Usamos ULID opacos, lo que lo dificulta, pero la deteccion sigue haciendo
   * falta: los identificadores opacos no impiden intentarlo.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async detectarRafagas403(): Promise<void> {
    const desde = new Date(Date.now() - 5 * 60_000);

    const agrupado = await this.prisma.eventoAuditoria.groupBy({
      by: ['actorId'],
      where: { resultado: 'denegado', creadoEl: { gte: desde }, actorId: { not: null } },
      _count: { _all: true },
    });

    const umbral = this.entorno.ALERTA_UMBRAL_403_POR_MINUTO * 5;

    for (const grupo of agrupado) {
      if (grupo._count._all < umbral || !grupo.actorId) continue;
      await this.emitir(
        'rafaga-403',
        'alta',
        `${grupo._count._all} accesos denegados en 5 minutos desde una misma cuenta. ` +
          'Patron compatible con enumeracion de identificadores.',
        `rafaga-403:${grupo.actorId}:${ventana(desde, 5)}`,
        grupo.actorId,
      );
    }
  }

  /** Descargas masivas: exfiltracion de documentos por una cuenta autorizada. */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async detectarDescargasMasivas(): Promise<void> {
    const desde = new Date(Date.now() - 3_600_000);

    const agrupado = await this.prisma.eventoAuditoria.groupBy({
      by: ['actorId'],
      where: {
        accion: 'documento.descarga',
        resultado: 'exito',
        creadoEl: { gte: desde },
        actorId: { not: null },
      },
      _count: { _all: true },
    });

    for (const grupo of agrupado) {
      if (grupo._count._all < this.entorno.ALERTA_UMBRAL_DESCARGAS_POR_HORA || !grupo.actorId) {
        continue;
      }
      await this.emitir(
        'descargas-masivas',
        'alta',
        `${grupo._count._all} descargas de documentos en una hora desde una misma cuenta.`,
        `descargas-masivas:${grupo.actorId}:${ventana(desde, 60)}`,
        grupo.actorId,
      );
    }
  }

  /**
   * Profesor recien asignado que captura de inmediato.
   *
   * Primera mitad del ataque del escenario 5 de SC-LAB-001. Por si sola la
   * conducta puede ser legitima —un profesor que sustituye a otro a mitad de
   * periodo y se pone al dia— asi que la severidad es media y lo que produce
   * es una revision, no un bloqueo. Combinada con la siguiente alerta sobre la
   * misma asignacion, el patron deja de ser ambiguo.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async detectarCapturaInmediata(): Promise<void> {
    const ventanaMin = this.entorno.ALERTA_MINUTOS_CAPTURA_INMEDIATA;
    const desde = new Date(Date.now() - ventanaMin * 60_000);

    const asignacionesRecientes = await this.prisma.asignacionDocente.findMany({
      where: { creadaEl: { gte: desde } },
      select: {
        idPublico: true,
        creadaEl: true,
        profesorId: true,
        grupo: { select: { idPublico: true, clave: true } },
        profesor: { select: { correo: true } },
      },
    });

    for (const asignacion of asignacionesRecientes) {
      const capturas = await this.prisma.eventoAuditoria.count({
        where: {
          actorId: asignacion.profesorId,
          accion: { in: ['calificacion.captura', 'calificacion.publicacion'] },
          recursoId: asignacion.grupo.idPublico,
          creadoEl: { gte: asignacion.creadaEl },
        },
      });

      if (capturas === 0) continue;

      await this.emitir(
        'captura-inmediata-tras-asignacion',
        'media',
        `El profesor ${asignacion.profesor.correo} capturo calificaciones del grupo ` +
          `${asignacion.grupo.clave} dentro de los ${ventanaMin} minutos siguientes a ` +
          'ser asignado. Revisar si la asignacion fue legitima.',
        `captura-inmediata:${asignacion.idPublico}`,
        asignacion.profesorId,
      );
    }
  }

  /**
   * Asignacion creada y revertida poco despues.
   *
   * Segunda mitad del ataque, y la mas reveladora: una asignacion que dura
   * minutos no tiene ninguna explicacion academica. Es el unico control que ve
   * el paso intermedio de "me asigne, califique, reverti", porque despues de
   * revertir el sistema queda en un estado final perfectamente consistente.
   *
   * Solo es posible porque la asignacion se **versiona** en vez de
   * sobrescribirse. Con un campo `profesorId` actualizable en la tabla de
   * grupos, esta consulta no tendria nada que mirar.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async detectarReversionSospechosa(): Promise<void> {
    const ventanaMin = this.entorno.ALERTA_MINUTOS_REVERSION_SOSPECHOSA;
    const desde = new Date(Date.now() - 24 * 3_600_000);

    const cerradas = await this.prisma.asignacionDocente.findMany({
      where: { hastaEl: { not: null, gte: desde } },
      select: {
        idPublico: true,
        desdeEl: true,
        hastaEl: true,
        creadaEl: true,
        autorId: true,
        profesor: { select: { correo: true } },
        grupo: { select: { clave: true } },
      },
    });

    for (const asignacion of cerradas) {
      if (!asignacion.hastaEl) continue;

      const duracionMin = Math.round(
        (asignacion.hastaEl.getTime() - asignacion.creadaEl.getTime()) / 60_000,
      );

      if (duracionMin > ventanaMin || duracionMin < 0) continue;

      await this.emitir(
        'asignacion-revertida-pronto',
        'alta',
        `La asignacion de ${asignacion.profesor.correo} al grupo ${asignacion.grupo.clave} ` +
          `duro ${duracionMin} minutos. Una asignacion docente de tan corta duracion no ` +
          'tiene explicacion academica ordinaria; revisar si hubo captura de ' +
          'calificaciones durante ese lapso.',
        `reversion-sospechosa:${asignacion.idPublico}`,
        asignacion.autorId,
      );
    }
  }

  /** Volumen anormal de correcciones sobre calificaciones ya publicadas. */
  @Cron(CronExpression.EVERY_HOUR)
  async detectarCorreccionesAnormales(): Promise<void> {
    const desde = new Date(Date.now() - 24 * 3_600_000);

    const agrupado = await this.prisma.eventoAuditoria.groupBy({
      by: ['actorId'],
      where: { accion: 'calificacion.correccion', creadoEl: { gte: desde }, actorId: { not: null } },
      _count: { _all: true },
    });

    for (const grupo of agrupado) {
      if (grupo._count._all < 5 || !grupo.actorId) continue;
      await this.emitir(
        'correcciones-anormales',
        'alta',
        `${grupo._count._all} correcciones de calificaciones publicadas en 24 horas ` +
          'desde una misma cuenta. La correccion es un flujo excepcional: ' +
          'un volumen asi sugiere que se esta usando como via ordinaria.',
        `correcciones-anormales:${grupo.actorId}:${ventana(desde, 1440)}`,
        grupo.actorId,
      );
    }
  }

  /**
   * Cambios de privilegio.
   *
   * Severidad critica sin umbral: **uno solo basta**. SC-LAB-001 escenario 4
   * describe el impacto de un cambio de privilegio no autorizado como
   * "control total del sistema... otorgamiento de privilegios permanentes al
   * atacante". No hay un numero de cambios de rol que sea "normal" y a partir
   * del cual empiece a preocupar: todos deben mirarse.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async detectarCambiosDePrivilegio(): Promise<void> {
    const desde = new Date(Date.now() - 10 * 60_000);

    const eventos = await this.prisma.eventoAuditoria.findMany({
      where: {
        accion: { in: ['rol.asignacion', 'rol.revocacion', 'permiso.cambio'] },
        creadoEl: { gte: desde },
      },
      select: { id: true, accion: true, actorId: true, actorCorreo: true, recursoId: true },
    });

    for (const evento of eventos) {
      await this.emitir(
        'cambio-privilegio',
        'critica',
        `${evento.accion} ejecutada por ${evento.actorCorreo ?? 'cuenta desconocida'}. ` +
          'Todo cambio en el modelo de autorizacion requiere revision.',
        `cambio-privilegio:${evento.id}`,
        evento.actorId,
        evento.id,
      );
    }
  }

  /**
   * Revision de asignaciones de rol vencidas (RF-072).
   *
   * Cierra lo que SC-LAB-001 §6 identifica como un modo real de degradacion:
   * "Los roles se otorgan y casi nunca se revocan. Sin revision periodica ni
   * caducidad, con el tiempo demasiadas cuentas terminan pudiendo demasiado."
   *
   * La revocacion efectiva ya es automatica —`permisosVigentes` filtra por
   * fecha en cada peticion— asi que esto solo marca la fila y deja constancia.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async revocarAsignacionesVencidas(): Promise<void> {
    const ahora = new Date();
    const resultado = await this.prisma.asignacionRol.updateMany({
      where: { revocadaEl: null, hastaEl: { not: null, lte: ahora } },
      data: { revocadaEl: ahora },
    });

    if (resultado.count > 0) {
      this.logger.log(`Revocadas ${resultado.count} asignaciones de rol vencidas`);
    }

    const porRevisar = await this.prisma.asignacionRol.count({
      where: { revocadaEl: null, revisarEl: { not: null, lte: ahora } },
    });

    if (porRevisar > 0) {
      await this.emitir(
        'cambio-privilegio',
        'media',
        `${porRevisar} asignaciones de rol superaron su fecha de revision y siguen ` +
          'vigentes. Requieren revision manual (RF-071).',
        `revision-pendiente:${ahora.toISOString().slice(0, 10)}`,
      );
    }
  }
}

/** Identificador estable de una ventana temporal, para la idempotencia. */
function ventana(desde: Date, minutos: number): string {
  return String(Math.floor(desde.getTime() / (minutos * 60_000)));
}
