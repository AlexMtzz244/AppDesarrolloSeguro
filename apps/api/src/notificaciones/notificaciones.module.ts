import { Global, Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service.js';
import { NotificacionesWorker } from './notificaciones.worker.js';

@Global()
@Module({
  providers: [NotificacionesService, NotificacionesWorker],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
