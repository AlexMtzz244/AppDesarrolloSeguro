import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ulid } from 'ulid';
import { ES_PERMISO, type Permiso } from '@securecampus/contracts';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { contextoActual } from '../comun/correlacion.js';
import type { ClienteTransaccion } from '../comun/prisma.service.js';
import { PrismaService } from '../comun/prisma.service.js';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';

/**
 * Sesiones opacas, rotatorias y revocables (RNFS-011 a RNFS-014).
 *
 * # Por que no un JWT
 *
 * Un JWT es legible por el cliente y, sobre todo, **no se puede revocar** sin
 * montar de todos modos una lista de revocacion en servidor — es decir, sin
 * reinventar la sesion. Como SC-LAB-003 §3 senala, el criterio que mas pesa es
 * (f): el cambio de contrasena debe invalidar las sesiones activas. Con un
 * token autocontenido eso es imposible; el atacante que ya entro conserva su
 * acceso aunque la victima cambie su credencial.
 *
 * Aqui la sesion es un valor aleatorio sin significado. Todo lo que importa
 * —a quien pertenece, si sigue viva, que permisos tiene— se resuelve en el
 * servidor en cada peticion.
 *
 * # Por que se guarda solo el hash
 *
 * Mismo razonamiento que para contrasenas y tokens de recuperacion: si la base
 * se filtra, no se obtienen sesiones utilizables.
 */
@Injectable()
export class SesionService {
  private readonly logger = new Logger(SesionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(TOKEN_ENTORNO) private readonly entorno: Entorno,
  ) {}

  /**
   * Crea una sesion nueva.
   *
   * Se llama en cada login y en cada elevacion de privilegio (RNFS-013). No
   * existe un metodo que "reutilice" la sesion previa: la unica forma de
   * obtener una sesion es crearla, con lo que la fijacion de sesion —la
   * vulnerabilidad (e) del escenario 3 de SC-LAB-001— no es representable.
   */
  async crear(
    tx: ClienteTransaccion,
    usuarioId: string,
    opciones: { mfaVerificada: boolean; huellaDispositivo?: string | null },
  ): Promise<{ token: string; sesionId: string; expiraEl: Date }> {
    const token = randomBytes(32).toString('base64url');
    const contexto = contextoActual();
    const ahora = new Date();

    const expiraEl = new Date(
      ahora.getTime() + this.entorno.SESION_DURACION_MAXIMA_HORAS * 3_600_000,
    );

    const sesion = await tx.sesion.create({
      data: {
        idPublico: ulid(),
        usuarioId,
        tokenHash: hashToken(token),
        expiraEl,
        ip: contexto?.ip ?? null,
        userAgent: contexto?.userAgent ?? null,
        huellaDispositivo: opciones.huellaDispositivo ?? null,
        mfaVerificada: opciones.mfaVerificada,
      },
      select: { id: true, idPublico: true },
    });

    return { token, sesionId: sesion.idPublico, expiraEl };
  }

  /**
   * Resuelve el actor de la peticion.
   *
   * Devuelve `null` —no lanza— cuando no hay sesion valida, para que el guard
   * decida si eso es un 401 o una ruta publica.
   */
  async resolverActor(req: Request): Promise<Actor | null> {
    const token = this.leerCookie(req);
    if (!token) return null;

    const ahora = new Date();

    const sesion = await this.prisma.sesion.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        idPublico: true,
        usuarioId: true,
        expiraEl: true,
        revocadaEl: true,
        ultimaActividadEl: true,
        mfaVerificada: true,
        usuario: {
          select: {
            id: true,
            idPublico: true,
            correo: true,
            activo: true,
            sesionesValidasDesde: true,
            perfil: { select: { programaId: true } },
          },
        },
      },
    });

    if (!sesion) return null;
    if (sesion.revocadaEl) return null;
    if (sesion.expiraEl <= ahora) return null;
    if (!sesion.usuario.activo) return null;

    // Revocacion global sin recorrer sesiones (RNFS-014). Al cambiar la
    // contrasena se avanza `sesionesValidasDesde`, y toda sesion emitida antes
    // deja de valer en la siguiente peticion, sin importar cuantas fueran ni
    // en cuantos dispositivos.
    if (sesion.ultimaActividadEl < sesion.usuario.sesionesValidasDesde) {
      return null;
    }

    // Expiracion por inactividad (RNFS-012).
    const limiteInactividad = new Date(
      sesion.ultimaActividadEl.getTime() + this.entorno.SESION_INACTIVIDAD_MINUTOS * 60_000,
    );
    if (limiteInactividad <= ahora) {
      await this.prisma.sesion.update({
        where: { id: sesion.id },
        data: { revocadaEl: ahora, motivoRevocacion: 'inactividad' },
      });
      return null;
    }

    // Se refresca la actividad con granularidad de un minuto para no escribir
    // en cada peticion. La ventana de inactividad es de decenas de minutos, asi
    // que un minuto de imprecision no debilita el control.
    if (ahora.getTime() - sesion.ultimaActividadEl.getTime() > 60_000) {
      await this.prisma.sesion.update({
        where: { id: sesion.id },
        data: { ultimaActividadEl: ahora },
      });
    }

    const { permisos, roles } = await this.permisosVigentes(sesion.usuarioId, ahora);

    return {
      usuarioId: sesion.usuario.id,
      idPublico: sesion.usuario.idPublico,
      correo: sesion.usuario.correo,
      sesionId: sesion.idPublico,
      permisos,
      roles,
      programaId: sesion.usuario.perfil?.programaId ?? null,
      mfaVerificada: sesion.mfaVerificada,
    };
  }

  /**
   * Permisos efectivos del usuario **en este instante**.
   *
   * Se recalculan en cada peticion y se filtran por vigencia. Un permiso cuya
   * asignacion vencio deja de aplicar sin que nadie ejecute una tarea de
   * limpieza: la caducidad es parte de la consulta, no un proceso aparte que
   * pueda fallar.
   *
   * SC-LAB-001 §6 identifica "los permisos que se acumulan" como uno de los
   * modos reales en que estos sistemas se degradan. Filtrar por vigencia aqui
   * es lo que hace que la revocacion sea automatica.
   */
  private async permisosVigentes(
    usuarioId: string,
    ahora: Date,
  ): Promise<{ permisos: ReadonlySet<Permiso>; roles: string[] }> {
    const asignaciones = await this.prisma.asignacionRol.findMany({
      where: {
        usuarioId,
        revocadaEl: null,
        desdeEl: { lte: ahora },
        OR: [{ hastaEl: null }, { hastaEl: { gt: ahora } }],
      },
      select: {
        rol: {
          select: {
            clave: true,
            permisos: { select: { permiso: { select: { clave: true } } } },
          },
        },
      },
    });

    const permisos = new Set<Permiso>();
    const roles: string[] = [];

    for (const asignacion of asignaciones) {
      roles.push(asignacion.rol.clave);
      for (const rp of asignacion.rol.permisos) {
        const clave = rp.permiso.clave;
        // Se descarta cualquier clave que no este en el catalogo cerrado. Un
        // permiso inventado directamente en la base no otorga nada.
        if (ES_PERMISO(clave)) permisos.add(clave);
        else this.logger.warn(`Permiso desconocido en base de datos: ${clave}`);
      }
    }

    return { permisos, roles };
  }

  /** Revoca una sesion concreta (RF-006). */
  async revocar(
    tx: ClienteTransaccion,
    sesionIdPublico: string,
    usuarioId: string,
    motivo: string,
  ): Promise<boolean> {
    const resultado = await tx.sesion.updateMany({
      // El filtro por `usuarioId` no sobra: sin el, conocer el identificador
      // de una sesion ajena bastaria para cerrarla. Seria un IDOR con efecto
      // de denegacion de servicio.
      where: { idPublico: sesionIdPublico, usuarioId, revocadaEl: null },
      data: { revocadaEl: new Date(), motivoRevocacion: motivo.slice(0, 120) },
    });
    return resultado.count > 0;
  }

  /**
   * Revoca TODAS las sesiones del usuario (RNFS-014).
   *
   * Avanza `sesionesValidasDesde` ademas de marcar las filas: la marca invalida
   * las sesiones existentes y el avance invalida cualquiera que estuviera
   * creandose en una peticion concurrente.
   */
  async revocarTodas(
    tx: ClienteTransaccion,
    usuarioId: string,
    motivo: string,
  ): Promise<number> {
    const ahora = new Date();

    const resultado = await tx.sesion.updateMany({
      where: { usuarioId, revocadaEl: null },
      data: { revocadaEl: ahora, motivoRevocacion: motivo.slice(0, 120) },
    });

    await tx.usuario.update({
      where: { id: usuarioId },
      data: { sesionesValidasDesde: ahora },
    });

    return resultado.count;
  }

  // --- Cookie --------------------------------------------------------------

  private leerCookie(req: Request): string | null {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const valor = cookies?.[this.entorno.SESION_COOKIE_NOMBRE];
    return typeof valor === 'string' && valor.length >= 32 ? valor : null;
  }

  escribirCookie(res: Response, token: string, expiraEl: Date): void {
    res.cookie(this.entorno.SESION_COOKIE_NOMBRE, token, {
      httpOnly: true, // Inalcanzable desde JavaScript: un XSS no roba la sesion.
      secure: this.entorno.SESION_COOKIE_SECURE,
      // `strict` romperia el retorno desde el enlace de recuperacion enviado
      // por correo. `lax` mantiene la proteccion CSRF para POST entre sitios,
      // que es donde importa.
      sameSite: 'lax',
      path: '/',
      expires: expiraEl,
    });
  }

  borrarCookie(res: Response): void {
    res.clearCookie(this.entorno.SESION_COOKIE_NOMBRE, {
      httpOnly: true,
      secure: this.entorno.SESION_COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
    });
  }
}

/**
 * SHA-256 del token de sesion.
 *
 * Basta un hash rapido, a diferencia de las contrasenas: el token tiene 256
 * bits de entropia real, asi que no hay nada que adivinar por fuerza bruta.
 * Argon2 aqui solo anadiria latencia a cada peticion sin aportar seguridad.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparacion en tiempo constante, para no filtrar por latencia. */
export function comparacionSegura(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
