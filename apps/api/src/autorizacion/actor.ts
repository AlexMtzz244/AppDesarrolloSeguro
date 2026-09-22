import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permiso } from '@securecampus/contracts';

/**
 * El actor de la peticion, resuelto **siempre** en el servidor (RNFS-003).
 *
 * Este objeto se construye a partir de la sesion recuperada de la base de
 * datos, nunca de nada que venga en el cuerpo, la query o una cabecera.
 *
 * SC-LAB-001 escenario 4 describe la vulnerabilidad que esto cierra: "el rol
 * se toma de un valor enviado por el cliente en lugar de derivarse de la
 * sesion en el servidor". Un cliente puede alterar cuanto quiera lo que
 * manda; no puede alterar lo que el servidor va a leer de su propia base.
 */
export interface Actor {
  readonly usuarioId: string;
  readonly idPublico: string;
  readonly correo: string;
  readonly sesionId: string;
  readonly permisos: ReadonlySet<Permiso>;
  readonly roles: readonly string[];
  /** Programa de adscripcion. Acota el alcance del jefe de carrera. */
  readonly programaId: string | null;
  readonly mfaVerificada: boolean;
}

export function tienePermiso(actor: Actor, permiso: Permiso): boolean {
  return actor.permisos.has(permiso);
}

/** Inyecta el actor en un manejador. Solo existe si el guard lo resolvio. */
export const ActorActual = createParamDecorator(
  (_datos: unknown, ctx: ExecutionContext): Actor => {
    const req = ctx.switchToHttp().getRequest<{ actor?: Actor }>();
    if (!req.actor) {
      // No deberia ocurrir: el guard corre antes y rechaza la peticion sin
      // sesion. Si ocurre, es un error de cableado y debe romper ruidosamente
      // en vez de entregar un actor vacio que pasaria las verificaciones.
      throw new Error(
        'ActorActual usado en una ruta sin sesion resuelta. Revisa el PoliticaGuard.',
      );
    }
    return req.actor;
  },
);
