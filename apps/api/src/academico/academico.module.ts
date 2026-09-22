import { Module } from '@nestjs/common';
import { AcademicoController } from './academico.controller.js';
import { AsignacionesService } from './asignaciones.service.js';
import { GruposService } from './grupos.service.js';
import { PeriodosService } from './periodos.service.js';

@Module({
  controllers: [AcademicoController],
  providers: [GruposService, AsignacionesService, PeriodosService],
  exports: [AsignacionesService, PeriodosService],
})
export class AcademicoModule {}
