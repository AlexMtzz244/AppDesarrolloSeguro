import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccesoDenegado } from '../comun/excepciones.filter.js';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';

/**
 * Defensa CSRF por verificacion de origen (SC-LAB-007, §11).
 *
 * La cookie de sesion viaja sola: el navegador la adjunta a cualquier peticion
 * hacia este dominio, venga de donde venga. `SameSite=Lax` ya impide que se
 * envie en POST/PATCH/DELETE entre sitios, pero es una proteccion del
 * navegador, no del servidor. Este guard hace que el servidor tambien lo
 * exija: una peticion que cambia estado y declara venir de otro origen se
 * rechaza ANTES de resolver la sesion.
 *
 * Se apoya en dos cabeceras que el navegador pone y que JavaScript de otra
 * pagina no puede falsear (son "forbidden header names"): `Origin` y
 * `Sec-Fetch-Site`.
 *
 * Lo que NO hace, a proposito:
 *   - No toca los metodos seguros (GET, HEAD, OPTIONS): no cambian estado, y la
 *     lectura entre origenes ya la limita CORS.
 *   - No exige cabecera a quien no la envia (curl, otro servicio, pruebas).
 *     Un cliente que no es navegador no tiene una cookie "ambiente" que alguien
 *     pueda aprovechar: si manda la cookie es porque la tiene.
 */

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type DecisionOrigen =
  | { readonly permitido: true }
  | { readonly permitido: false; readonly motivo: string };

export interface EntradaOrigen {
  readonly metodo: string;
  readonly origin: string | undefined;
  readonly secFetchSite: string | undefined;
}

/** Quita la barra final para comparar `https://a.mx` con `https://a.mx/`. */
function normalizar(origen: string): string {
  return origen.trim().replace(/\/+$/, '');
}

/** Regla pura: recibe hechos de la peticion y devuelve la decision. */
export function evaluarOrigen(
  entrada: EntradaOrigen,
  origenesPermitidos: readonly string[],
): DecisionOrigen {
  if (METODOS_SEGUROS.has(entrada.metodo.toUpperCase())) return { permitido: true };

  if (entrada.origin !== undefined) {
    const lista = new Set(origenesPermitidos.map(normalizar));
    // `Origin: null` (iframe con sandbox, redireccion entre sitios, archivo
    // local) no esta en la lista y por tanto se rechaza.
    return lista.has(normalizar(entrada.origin))
      ? { permitido: true }
      : { permitido: false, motivo: `origen-no-permitido:${entrada.origin}` };
  }

  // Sin `Origin` (algunos navegadores antiguos): el segundo indicio es
  // `Sec-Fetch-Site`. Solo `cross-site` es un rechazo; la ausencia total de
  // ambas cabeceras corresponde a un cliente que no es navegador.
  if (entrada.secFetchSite === 'cross-site') {
    return { permitido: false, motivo: 'sec-fetch-site:cross-site' };
  }

  return { permitido: true };
}

@Injectable()
export class OrigenGuard implements CanActivate {
  private readonly logger = new Logger(OrigenGuard.name);

  constructor(@Inject(TOKEN_ENTORNO) private readonly entorno: Entorno) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const decision = evaluarOrigen(
      {
        metodo: req.method,
        origin: req.header('origin'),
        secFetchSite: req.header('sec-fetch-site'),
      },
      this.entorno.CORS_ORIGENES_PERMITIDOS,
    );

    if (!decision.permitido) {
      // Misma respuesta que cualquier otra denegacion (RNFS-006): no se le
      // explica al llamante cual de las comprobaciones fallo.
      this.logger.warn(`Peticion ${req.method} ${req.path} rechazada: ${decision.motivo}`);
      throw new AccesoDenegado();
    }

    return true;
  }
}
