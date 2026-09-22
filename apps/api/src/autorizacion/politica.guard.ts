import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISOS_QUE_EXIGEN_MOTIVO, esquemaMotivo } from '@securecampus/contracts';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { contextoActual } from '../comun/correlacion.js';
import { AccesoDenegado, ErrorNegocio } from '../comun/excepciones.filter.js';
import { PrismaService } from '../comun/prisma.service.js';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';
import { SesionService } from '../identidad/sesion.service.js';
import type { Actor } from './actor.js';
import {
  CLAVE_POLITICA,
  CLAVE_PUBLICO,
  type DefinicionPolitica,
} from './politica.decorator.js';

/**
 * Guard global de autorizacion.
 *
 * Es el punto unico donde se decide si una peticion procede, y aplica cuatro
 * comprobaciones en este orden:
 *
 *   1. Deny by default — sin politica declarada, 403 (RNFS-002).
 *   2. Sesion valida, resuelta en servidor (RNFS-003, RNFS-011).
 *   3. Permiso granular por operacion (RNFS-004).
 *   4. Relacion actor-recurso contra la base (RNFS-005).
 *
 * El paso 4 es el que distingue este diseno de una comprobacion de roles.
 * SC-LAB-001 §5.3 lo enuncia: "el profesor del escenario 1 es legitimamente
 * profesor y aun asi no debe poder escribir en un grupo que no le fue
 * asignado: el rol es correcto, la relacion no".
 *
 * Que sea un guard **global** y no uno aplicado ruta por ruta es deliberado:
 * un guard que hay que recordar poner es un guard que algun dia se olvida.
 */
@Injectable()
export class PoliticaGuard implements CanActivate {
  private readonly logger = new Logger(PoliticaGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly sesiones: SesionService,
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(TOKEN_ENTORNO) private readonly entorno: Entorno,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;

    const req = ctx.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const manejador = ctx.getHandler();
    const clase = ctx.getClass();

    // --- 1. Publico explicito -------------------------------------------
    const razonPublica = this.reflector.getAllAndOverride<string | undefined>(
      CLAVE_PUBLICO,
      [manejador, clase],
    );
    if (razonPublica) return true;

    // --- 1b. Deny by default --------------------------------------------
    const politica = this.reflector.getAllAndOverride<DefinicionPolitica | undefined>(
      CLAVE_POLITICA,
      [manejador, clase],
    );

    if (!politica) {
      // Una ruta sin politica es un error de programacion, no un intento de
      // ataque. Se registra en nivel alto para que se note en desarrollo, y
      // aun asi se responde 403: el hueco no se abre mientras alguien lo
      // corrige. La prueba estructural de `politicas-declaradas.spec.ts`
      // hace fallar la build antes de llegar aqui.
      this.logger.error(
        `Ruta sin politica declarada: ${clase.name}.${manejador.name}. ` +
          'Respondiendo 403 por deny by default (RNFS-002).',
      );
      throw new AccesoDenegado();
    }

    // --- 2. Sesion --------------------------------------------------------
    const actor = await this.sesiones.resolverActor(req);
    if (!actor) {
      throw new UnauthorizedException({
        codigo: 'SESION_INVALIDA',
        mensaje: 'Credenciales invalidas o sesion expirada.',
      });
    }

    req.actor = actor;
    const contexto = contextoActual();
    if (contexto) {
      contexto.actorId = actor.usuarioId;
      contexto.actorCorreo = actor.correo;
    }

    // --- 2b. Segundo factor ----------------------------------------------
    if (politica.exigeMfa && !actor.mfaVerificada) {
      await this.denegar(actor, politica, req, 'mfa-no-verificada');
    }

    // --- 3. Permiso granular ---------------------------------------------
    if (!actor.permisos.has(politica.permiso)) {
      await this.denegar(actor, politica, req, `sin-permiso:${politica.permiso}`);
    }

    // --- 3b. Motivo obligatorio ------------------------------------------
    const exigeMotivo =
      politica.exigeMotivo ?? PERMISOS_QUE_EXIGEN_MOTIVO.includes(politica.permiso);

    if (exigeMotivo) {
      const cuerpo = req.body as { motivo?: unknown } | undefined;
      if (!esquemaMotivo.safeParse(cuerpo?.motivo).success) {
        throw new ErrorNegocio(
          'MOTIVO_REQUERIDO',
          'Esta operacion exige un motivo de al menos 10 caracteres.',
        );
      }
    }

    // --- 4. Relacion actor-recurso ---------------------------------------
    if (politica.relacion === 'no-aplica') return true;

    const decision = await politica.relacion({
      actor,
      params: req.params as Record<string, string>,
      query: req.query as Record<string, unknown>,
      body: req.body,
      prisma: this.prisma,
    });

    if (!decision.permitido) {
      await this.denegar(actor, politica, req, decision.motivoTecnico);
    }

    if ('recurso' in decision && decision.recurso !== undefined) {
      // Se adjunta para que el manejador no vuelva a consultarlo. Ademas de
      // ahorrar una consulta, evita el patron de "el guard verifico un
      // registro y el servicio recupero otro".
      (req as Request & { recurso?: unknown }).recurso = decision.recurso;
    }

    return true;
  }

  /**
   * Deniega y registra.
   *
   * El evento se escribe **siempre** (RNFS-033), porque una rafaga de 403 del
   * mismo actor es la firma de alguien enumerando y es lo que alimenta la
   * alerta `rafaga-403`. La respuesta, en cambio, es siempre la misma sin
   * importar el motivo tecnico: distinguirlos le diria al atacante que tan
   * cerca estuvo.
   */
  private async denegar(
    actor: Actor,
    politica: DefinicionPolitica,
    req: Request,
    motivoTecnico: string,
  ): Promise<never> {
    await this.auditoria.registrarFueraDeMutacion({
      accion: 'acceso.denegado',
      tipoRecurso: politica.permiso.split(':')[0] ?? 'desconocido',
      recursoId: typeof req.params['id'] === 'string' ? req.params['id'] : null,
      resultado: 'denegado',
      motivo: motivoTecnico,
      actorId: actor.usuarioId,
      actorCorreo: actor.correo,
      despues: { ruta: `${req.method} ${req.path}`, permiso: politica.permiso },
    });

    throw new AccesoDenegado();
  }
}
