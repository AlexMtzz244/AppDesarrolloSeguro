import { Module } from '@nestjs/common';
import { AutenticacionController } from './autenticacion.controller.js';
import { AutenticacionService } from './autenticacion.service.js';
import { ContrasenaService } from './contrasena.service.js';
import { LimiteIntentosService } from './limite-intentos.service.js';
import { MfaService } from './mfa.service.js';
import { RecuperacionService } from './recuperacion.service.js';
import { SesionService } from './sesion.service.js';

/**
 * Identidad, sesion, segundo factor y recuperacion.
 *
 * `SesionService` y `MfaService` se exportan porque el guard global los
 * necesita para resolver el actor de cada peticion.
 */
@Module({
  controllers: [AutenticacionController],
  providers: [
    AutenticacionService,
    ContrasenaService,
    LimiteIntentosService,
    MfaService,
    RecuperacionService,
    SesionService,
  ],
  exports: [SesionService, MfaService, ContrasenaService],
})
export class IdentidadModule {}
