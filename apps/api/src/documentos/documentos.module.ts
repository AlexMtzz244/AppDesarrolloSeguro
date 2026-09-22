import { Module } from '@nestjs/common';
import { AlmacenamientoService } from './almacenamiento.service.js';
import { AntivirusService } from './antivirus.service.js';
import { DocumentosController } from './documentos.controller.js';
import { DocumentosService } from './documentos.service.js';

@Module({
  controllers: [DocumentosController],
  providers: [DocumentosService, AlmacenamientoService, AntivirusService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
