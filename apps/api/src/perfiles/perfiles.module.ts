import { Module } from '@nestjs/common';
import { PerfilesController } from './perfiles.controller.js';
import { PerfilesService } from './perfiles.service.js';

@Module({
  controllers: [PerfilesController],
  providers: [PerfilesService],
})
export class PerfilesModule {}
