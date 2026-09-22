import type { Readable } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import NodeClam from 'clamscan';
import type { EstadoAntivirus } from '@securecampus/contracts';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';

export interface VeredictoAntivirus {
  readonly limpio: boolean;
  readonly estado: EstadoAntivirus;
  readonly detalle?: string;
}

/**
 * Analisis antivirus y reescaneo periodico (RF-053, RF-054).
 *
 * El reescaneo responde a algo que ninguna fase temprana puede resolver, y que
 * SC-LAB-002 escenario A formula con precision: **el archivo no cambia, cambia
 * lo que sabemos sobre el**. Un archivo que hoy pasa limpio puede reconocerse
 * como malicioso manana, cuando las firmas se actualicen.
 *
 * Es tambien el ejemplo del laboratorio de un control que *si* se puede
 * agregar tarde sin penalizacion: se coloca delante de un flujo existente y el
 * resto del sistema no se entera. Por eso no compite en prioridad con la
 * autorizacion por recurso, que si atraviesa la arquitectura.
 */
@Injectable()
export class AntivirusService {
  private readonly logger = new Logger(AntivirusService.name);
  private clam?: NodeClam;

  constructor(@Inject(TOKEN_ENTORNO) private readonly entorno: Entorno) {}

  private async cliente(): Promise<NodeClam> {
    this.clam ??= await new NodeClam().init({
      clamdscan: {
        host: this.entorno.CLAMAV_HOST,
        port: this.entorno.CLAMAV_PORT,
        timeout: 60_000,
      },
      preference: 'clamdscan',
    });
    return this.clam;
  }

  async analizar(flujo: Readable): Promise<VeredictoAntivirus> {
    try {
      const clam = await this.cliente();
      const resultado = await clam.scanStream(flujo);

      if (resultado.isInfected) {
        return {
          limpio: false,
          estado: 'infectado',
          detalle: resultado.viruses.join(', '),
        };
      }

      return { limpio: true, estado: 'limpio' };
    } catch (error) {
      // Si el antivirus no responde, el veredicto es `error-analisis` y el
      // documento NO se entrega. Tratar el fallo como "limpio" convertiria una
      // caida del servicio en una via para colar cualquier archivo.
      this.logger.error({ error }, 'No se pudo completar el analisis antivirus');
      return {
        limpio: false,
        estado: 'error-analisis',
        detalle: 'El servicio de analisis no respondio.',
      };
    }
  }

}
