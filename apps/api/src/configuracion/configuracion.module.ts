import { Module } from '@nestjs/common';
import { DecisionesController } from './decisiones.controller.js';
import { DecisionesService } from './decisiones.service.js';

@Module({
  controllers: [DecisionesController],
  providers: [DecisionesService],
  exports: [DecisionesService],
})
export class ConfiguracionModule {}
