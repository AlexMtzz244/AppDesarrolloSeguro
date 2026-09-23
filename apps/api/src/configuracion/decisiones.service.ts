import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import {
  CATALOGO_DECISIONES,
  DECISIONES,
  DECISIONES_BLOQUEANTES,
  type EstadoDecision,
  type IdDecision,
} from '@securecampus/contracts';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { PrismaService } from '../comun/prisma.service.js';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';

/**
 * Estado de aprobación de las once decisiones institucionales.
 *
 * # El control que este servicio aporta
 *
 * SC-SRS-001 §8 prohíbe codificar valores inventados porque **se vuelven
 * invisibles**. Este servicio existe para que la propuesta del equipo no lo
 * sea: convierte una omisión silenciosa en un arranque fallido.
 *
 * Es el mismo patrón que `cargarEntorno` aplica a los secretos (RNFS-052) y
 * que el `REVOKE` aplica a la bitácora: el comportamiento seguro no depende de
 * que alguien se acuerde, depende de que el sistema se niegue.
 */
@Injectable()
export class DecisionesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DecisionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(TOKEN_ENTORNO) private readonly entorno: Entorno,
  ) {}

  /**
   * Verifica las firmas al arrancar.
   *
   * En producción, una decisión bloqueante sin aprobar **detiene el proceso**.
   * En desarrollo solo advierte: bloquear ahí impediría trabajar sin aportar
   * nada, porque en desarrollo no hay datos reales que proteger.
   */
  async onApplicationBootstrap(): Promise<void> {
    const pendientes = await this.bloqueantesSinAprobar();
    if (pendientes.length === 0) return;

    const detalle = pendientes
      .map((id) => `  - ${id}: ${CATALOGO_DECISIONES[id].titulo}\n      aprueba: ${CATALOGO_DECISIONES[id].apruebaArea}`)
      .join('\n');

    if (this.entorno.NODE_ENV === 'production') {
      this.logger.error(
        [
          '',
          '================================================================',
          ' SecureCampus no puede arrancar en produccion.',
          '',
          ` ${pendientes.length} decision(es) institucional(es) sin aprobar:`,
          '',
          detalle,
          '',
          ' El sistema tiene una propuesta para cada una y funcionaria con',
          ' ella, pero una propuesta sin firma es un valor que nadie decidio.',
          ' Ver proyDesSeguro/docs/DECISIONES-PENDIENTES.md.',
          '================================================================',
          '',
        ].join('\n'),
      );
      process.exit(1);
    }

    this.logger.warn(
      `${pendientes.length} decision(es) institucional(es) operan bajo propuesta ` +
        `sin aprobar: ${pendientes.join(', ')}. El arranque en produccion las exigira.`,
    );
  }

  async estado(): Promise<EstadoDecision[]> {
    const registros = await this.prisma.parametroConfiguracion.findMany({
      where: { decisionId: { not: null } },
      select: { decisionId: true, aprobadoPor: true, aprobadoEl: true },
    });

    // Una decisión se considera aprobada solo si TODOS sus parámetros lo
    // están. Aprobar a medias es lo mismo que no aprobar: quedarían valores
    // vigentes que nadie firmó.
    const porDecision = new Map<string, { total: number; aprobados: number; quien: string | null; cuando: Date | null }>();

    for (const registro of registros) {
      const id = registro.decisionId!;
      const acumulado = porDecision.get(id) ?? { total: 0, aprobados: 0, quien: null, cuando: null };
      acumulado.total += 1;
      if (registro.aprobadoPor && registro.aprobadoEl) {
        acumulado.aprobados += 1;
        acumulado.quien ??= registro.aprobadoPor;
        acumulado.cuando ??= registro.aprobadoEl;
      }
      porDecision.set(id, acumulado);
    }

    return DECISIONES.map((id) => {
      const acumulado = porDecision.get(id);
      const aprobada = Boolean(acumulado && acumulado.total > 0 && acumulado.aprobados === acumulado.total);
      return {
        id,
        aprobada,
        aprobadoPor: aprobada ? (acumulado?.quien ?? null) : null,
        aprobadoEl: aprobada ? (acumulado?.cuando?.toISOString() ?? null) : null,
      };
    });
  }

  async bloqueantesSinAprobar(): Promise<IdDecision[]> {
    const estado = await this.estado();
    const aprobadas = new Set(estado.filter((d) => d.aprobada).map((d) => d.id));
    return DECISIONES_BLOQUEANTES.filter((id) => !aprobadas.has(id));
  }

  /**
   * Registra la aprobación de una decisión.
   *
   * `aprobadoPor` guarda el nombre del área o persona que firma, **no** la
   * cuenta que operó el sistema: quien teclea no es necesariamente quien
   * decide. El actor que ejecutó queda en la bitácora, que es donde
   * corresponde.
   */
  async aprobar(actor: Actor, id: IdDecision, aprobadoPor: string, motivo: string) {
    const decision = CATALOGO_DECISIONES[id];

    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.parametroConfiguracion.findMany({
        where: { decisionId: id },
        select: { clave: true, aprobadoPor: true, aprobadoEl: true },
      });

      const ahora = new Date();
      const resultado = await tx.parametroConfiguracion.updateMany({
        where: { decisionId: id },
        data: { aprobadoPor: aprobadoPor.slice(0, 200), aprobadoEl: ahora },
      });

      await this.auditoria.registrar(tx, {
        accion: 'permiso.cambio',
        tipoRecurso: 'decision-institucional',
        recursoId: id,
        resultado: 'exito',
        motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        antes: { decision: id, aprobada: antes.every((p) => p.aprobadoPor) },
        despues: {
          decision: id,
          titulo: decision.titulo,
          aprobadoPor,
          parametrosAfectados: resultado.count,
          bloqueaProduccion: decision.bloqueaProduccion,
        },
      });

      return { id, aprobadoPor, aprobadoEl: ahora.toISOString(), parametros: resultado.count };
    });
  }
}
