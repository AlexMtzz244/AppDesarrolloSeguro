/**
 * Declaraciones para `clamscan`, que no publica tipos propios.
 *
 * Se declara solo la superficie que usamos, y no `any` global: un `declare
 * module 'clamscan'` a secas apagaria la comprobacion de tipos en el unico
 * punto del sistema que decide si un archivo se entrega o se retiene.
 */
declare module 'clamscan' {
  import type { Readable } from 'node:stream';

  interface OpcionesClamdscan {
    host?: string;
    port?: number;
    timeout?: number;
    socket?: string;
    localFallback?: boolean;
  }

  interface OpcionesInit {
    removeInfected?: boolean;
    debugMode?: boolean;
    preference?: 'clamdscan' | 'clamscan';
    clamdscan?: OpcionesClamdscan;
    clamscan?: { path?: string; scanArchives?: boolean };
  }

  interface ResultadoAnalisis {
    isInfected: boolean;
    viruses: string[];
    file?: string;
  }

  class NodeClam {
    init(opciones?: OpcionesInit): Promise<NodeClam>;
    scanStream(flujo: Readable): Promise<ResultadoAnalisis>;
    scanFile(ruta: string): Promise<ResultadoAnalisis>;
    isInfected(ruta: string): Promise<ResultadoAnalisis>;
  }

  export = NodeClam;
}
