import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../comun/prisma.service.js';
import { TOKEN_REDIS } from '../comun/redis.provider.js';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';
import { COLA_NOTIFICACIONES, type SolicitudNotificacion } from './notificaciones.service.js';

/**
 * Consumidor de la cola de notificaciones.
 *
 * Es el unico punto del sistema donde el token de recuperacion se convierte en
 * un enlace, y ese enlace no se guarda en ningun lado: se compone en memoria,
 * se envia y se descarta (RNFS-024).
 */
@Injectable()
export class NotificacionesWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificacionesWorker.name);
  private worker?: Worker<SolicitudNotificacion>;
  private readonly transporte: Transporter;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOKEN_REDIS) private readonly redis: Redis,
    @Inject(TOKEN_ENTORNO) private readonly entorno: Entorno,
  ) {
    this.transporte = nodemailer.createTransport({
      host: entorno.SMTP_HOST,
      port: entorno.SMTP_PORT,
      secure: false,
      ignoreTLS: entorno.NODE_ENV !== 'production',
    });
  }

  onModuleInit(): void {
    this.worker = new Worker<SolicitudNotificacion>(
      COLA_NOTIFICACIONES,
      async (job) => this.procesar(job.data),
      { connection: this.redis, concurrency: 5 },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        { jobId: job?.id, intento: job?.attemptsMade, error: error.message },
        'Fallo el envio de una notificacion',
      );
    });
  }

  private async procesar(datos: SolicitudNotificacion): Promise<void> {
    const notificacion = await this.prisma.notificacion.findUnique({
      where: { claveIdempotencia: datos.claveIdempotencia },
      select: {
        id: true,
        estadoEntrega: true,
        destinatario: { select: { correo: true, activo: true } },
      },
    });

    if (!notificacion) {
      this.logger.warn({ clave: datos.claveIdempotencia }, 'Notificacion sin registro');
      return;
    }

    // Segunda barrera de idempotencia: BullMQ puede reentregar un job si el
    // proceso murio despues de enviar pero antes de confirmar.
    if (notificacion.estadoEntrega === 'enviada') return;

    if (!notificacion.destinatario.activo) {
      await this.prisma.notificacion.update({
        where: { id: notificacion.id },
        data: { estadoEntrega: 'descartada' },
      });
      return;
    }

    if (datos.canal === 'en-aplicacion') {
      await this.marcarEnviada(notificacion.id);
      return;
    }

    try {
      await this.transporte.sendMail({
        from: this.entorno.SMTP_FROM,
        to: notificacion.destinatario.correo,
        subject: datos.titulo,
        text: this.componerCuerpo(datos),
      });
      await this.marcarEnviada(notificacion.id);
    } catch (error) {
      await this.prisma.notificacion.update({
        where: { id: notificacion.id },
        data: { estadoEntrega: 'fallida', intentos: { increment: 1 } },
      });
      throw error; // Deja que BullMQ aplique el backoff exponencial.
    }
  }

  /**
   * Compone el texto del correo.
   *
   * El enlace se construye aqui, a partir del token que viajo por la cola, y
   * nunca se escribe en la tabla `notificacion`. Un administrador con permiso
   * de lectura sobre las notificaciones no puede tomar el control de ninguna
   * cuenta leyendo ese registro.
   */
  private componerCuerpo(datos: SolicitudNotificacion): string {
    if (!datos.enlaceToken) return datos.cuerpo;

    const minutos = this.entorno.RECUPERACION_VIGENCIA_MINUTOS;
    const enlace = `${this.entorno.CORS_ORIGENES_PERMITIDOS[0] ?? ''}/recuperar/completar?token=${datos.enlaceToken}`;

    return [
      datos.cuerpo,
      '',
      enlace,
      '',
      `Este enlace vence en ${minutos} minutos y solo se puede usar una vez.`,
      'Si solicitas otro, este dejara de funcionar.',
    ].join('\n');
  }

  private async marcarEnviada(id: string): Promise<void> {
    await this.prisma.notificacion.update({
      where: { id },
      data: {
        estadoEntrega: 'enviada',
        enviadaEl: new Date(),
        intentos: { increment: 1 },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
