import { Global, Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller.js';
import { AuditoriaService } from './auditoria.service.js';

/**
 * La bitacora es transversal: casi todo modulo con mutaciones la necesita, y
 * el requisito RNFS-030 exige que el evento viva en la misma transaccion que
 * el cambio. Hacerla global evita que alguien omita el import y termine
 * escribiendo la mutacion sin su evento.
 */
@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
