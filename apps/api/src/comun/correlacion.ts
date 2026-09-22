import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Contexto de la peticion en curso.
 *
 * Existe para que el `correlationId` llegue hasta el evento de auditoria sin
 * tener que pasarlo como parametro por cada capa. Si hubiera que propagarlo a
 * mano, tarde o temprano alguna ruta lo perderia, y un evento sin correlacion
 * no se puede enlazar con la peticion que lo produjo (RNFS-032).
 */
export interface ContextoPeticion {
  readonly correlationId: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
  /** Se completa cuando el guard resuelve la sesion. */
  actorId?: string | undefined;
  actorCorreo?: string | undefined;
}

const almacen = new AsyncLocalStorage<ContextoPeticion>();

export function contextoActual(): ContextoPeticion | undefined {
  return almacen.getStore();
}

export function correlationIdActual(): string {
  return almacen.getStore()?.correlationId ?? 'sin-correlacion';
}

/**
 * Extrae la IP real del cliente respetando el numero de proxies de confianza.
 *
 * SC-LAB-002 escenario D, fase Despliegue: "Registrar la IP real detras del
 * proxy — sin esto, todos los intentos parecen venir del mismo origen y el
 * limite por IP es inutil".
 *
 * Se cuenta desde el final de `X-Forwarded-For` hacia atras, tantos saltos
 * como proxies propios haya. Tomar el primer valor de la cabecera seria un
 * error clasico: ese lo escribe el cliente y puede poner lo que quiera, con lo
 * que el limite por origen se evadiria mandando una IP distinta cada vez.
 */
export function ipReal(req: Request, saltosDeConfianza: number): string | null {
  const cabecera = req.headers['x-forwarded-for'];
  if (typeof cabecera === 'string' && saltosDeConfianza > 0) {
    const cadena = cabecera.split(',').map((v) => v.trim()).filter(Boolean);
    const indice = cadena.length - saltosDeConfianza;
    const candidata = cadena[indice >= 0 ? indice : 0];
    if (candidata) return candidata;
  }
  return req.socket.remoteAddress ?? null;
}

export function middlewareCorrelacion(saltosDeConfianza: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Se acepta un correlation id entrante solo si tiene forma de UUID. Un
    // valor libre del cliente terminaria en los logs y en la bitacora, y seria
    // una via de inyeccion en las herramientas que los consumen.
    const entrante = req.headers['x-correlation-id'];
    const esUuidValido =
      typeof entrante === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entrante);

    const contexto: ContextoPeticion = {
      correlationId: esUuidValido ? entrante : randomUUID(),
      ip: ipReal(req, saltosDeConfianza),
      userAgent: (req.headers['user-agent'] ?? null)?.toString().slice(0, 400) ?? null,
    };

    res.setHeader('X-Correlation-Id', contexto.correlationId);
    almacen.run(contexto, () => next());
  };
}
