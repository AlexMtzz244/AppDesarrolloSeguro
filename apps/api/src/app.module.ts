import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AcademicoModule } from './academico/academico.module.js';
import { AlertasModule } from './alertas/alertas.module.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { PoliticaGuard } from './autorizacion/politica.guard.js';
import { CalificacionesModule } from './calificaciones/calificaciones.module.js';
import { ComunModule } from './comun/comun.module.js';
import { ConfiguracionModule } from './configuracion/configuracion.module.js';
import { DocumentosModule } from './documentos/documentos.module.js';
import { IdentidadModule } from './identidad/identidad.module.js';
import { NotificacionesModule } from './notificaciones/notificaciones.module.js';
import { PerfilesModule } from './perfiles/perfiles.module.js';
import { SolicitudesModule } from './solicitudes/solicitudes.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

/**
 * Modulo raiz.
 *
 * El detalle que importa aqui es el `APP_GUARD`: el `PoliticaGuard` se
 * registra de forma **global**. No hay que acordarse de ponerlo en cada
 * controlador, y una ruta nueva nace protegida.
 *
 * SC-LAB-002 §5, decision 2: el deny by default "protege contra el olvido, que
 * es el modo real en que estos fallos llegan a produccion, no contra una
 * decision equivocada". Un guard que se aplica ruta por ruta protege contra
 * decisiones equivocadas, pero no contra el olvido — que es el caso comun.
 */
@Module({
  imports: [
    ComunModule,
    ConfiguracionModule,
    ScheduleModule.forRoot(),
    AuditoriaModule,
    NotificacionesModule,
    IdentidadModule,
    PerfilesModule,
    UsuariosModule,
    AcademicoModule,
    CalificacionesModule,
    DocumentosModule,
    SolicitudesModule,
    AlertasModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: PoliticaGuard }],
})
export class AppModule {}
