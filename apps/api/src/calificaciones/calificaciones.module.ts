import { Module } from '@nestjs/common';
import { AcademicoModule } from '../academico/academico.module.js';
import { CalificacionesController } from './calificaciones.controller.js';
import { CalificacionesService } from './calificaciones.service.js';

@Module({
  imports: [AcademicoModule],
  controllers: [CalificacionesController],
  providers: [CalificacionesService],
})
export class CalificacionesModule {}
