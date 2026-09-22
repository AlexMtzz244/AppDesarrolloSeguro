import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { ulid } from 'ulid';
import type { CanalNotificacion, TipoNotificacion } from '@securecampus/contracts';
import { PrismaService } from '../comun/prisma.service.js';
import { TOKEN_REDIS } from '../comun/redis.provider.js';

export const COLA_NOTIFICACIONES = 'sc:notificaciones';

export interface SolicitudNotificacion {
  readonly destinatarioId: string;
  readonly tipo: TipoNotificacion;
  readonly canal: CanalNotificacion;
  readonly titulo: string;
  readonly cuerpo: string;
  /**
   * Evita duplicados cuando la misma regla se evalua dos veces o un job se
   * reintenta (RF-091).
   */
  readonly claveIdempotencia: string;
  /**
   * Token de un solo uso para construir el enlace del correo.
   *
   * Viaja por la cola pero **no se persiste** en la tabla de notificaciones
   * (RNFS-024). Es la diferencia entre "el correo lleva el enlace" y "el
   * enlace queda guardado donde cualquiera con acceso de lectura lo vea".
   */
  readonly enlaceToken?: string;
}

/**
 * Notificaciones al titular (RF-046, RF-091).
 *
 * Su valor de seguridad no es obvio hasta leer SC-LAB-002 escenario C: "La
 * notificacion al estudiante es el control posterior de mayor valor por su
 * costo: es una fase de Operacion, se implementa en dos dias, y es el unico
 * control que funciona cuando el atacante esta formalmente autorizado."
 *
 * Contra un profesor con asignacion vigente que altera una nota, toda
 * verificacion preventiva responde correctamente. Lo unico que queda es que el
 * afectado se entere — convertirlo en un detector independiente del propio
 * sistema.
 *
 * Por eso el envio pasa por una cola con reintentos: una notificacion que se
 * pierde en silencio es un control que no existe.
 */
@Injectable()
export class NotificacionesService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificacionesService.name);
  private readonly cola: Queue<SolicitudNotificacion>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOKEN_REDIS) redis: Redis,
  ) {
    this.cola = new Queue<SolicitudNotificacion>(COLA_NOTIFICACIONES, {
      connection: redis,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: false, // Los fallos se conservan para poder investigarlos.
      },
    });
  }

  /**
   * Registra la notificacion y la encola.
   *
   * El registro en base de datos ocurre primero y de forma idempotente: si el
   * proceso muere entre ambas operaciones, queda constancia de que la
   * notificacion debia enviarse y un trabajo programado puede recuperarla. Al
   * reves —encolar primero— un fallo dejaria un envio sin rastro.
   */
  async encolar(solicitud: SolicitudNotificacion): Promise<void> {
    const existente = await this.prisma.notificacion.findUnique({
      where: { claveIdempotencia: solicitud.claveIdempotencia },
      select: { id: true },
    });

    if (existente) {
      this.logger.debug(
        { clave: solicitud.claveIdempotencia },
        'Notificacion ya registrada; no se duplica',
      );
      return;
    }

    await this.prisma.notificacion.create({
      data: {
        idPublico: ulid(),
        destinatarioId: solicitud.destinatarioId,
        tipo: solicitud.tipo,
        canal: solicitud.canal,
        titulo: solicitud.titulo.slice(0, 200),
        cuerpo: solicitud.cuerpo.slice(0, 2000),
        claveIdempotencia: solicitud.claveIdempotencia,
      },
    });

    await this.cola.add(solicitud.tipo, solicitud, {
      jobId: solicitud.claveIdempotencia,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.cola.close();
  }
}
