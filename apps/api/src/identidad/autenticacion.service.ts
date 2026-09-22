import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Response } from 'express';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { contextoActual } from '../comun/correlacion.js';
import { ErrorNegocio } from '../comun/excepciones.filter.js';
import { PrismaService } from '../comun/prisma.service.js';
import { TOKEN_REDIS } from '../comun/redis.provider.js';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { ContrasenaService } from './contrasena.service.js';
import { LimiteIntentosService } from './limite-intentos.service.js';
import { MfaService } from './mfa.service.js';
import { SesionService } from './sesion.service.js';

/**
 * Respuesta unica para cualquier fallo de autenticacion (RNFS-016).
 *
 * Es una constante y no un mensaje construido en cada punto, porque la unica
 * forma de garantizar que "credenciales invalidas" sea siempre identico es que
 * literalmente sea el mismo objeto. Cualquier variacion —usuario inexistente,
 * contrasena incorrecta, cuenta desactivada, MFA fallido— le diria al atacante
 * en que punto del proceso se detuvo.
 *
 * SC-LAB-001 escenario 3, vulnerabilidad (f): "Mensajes de error que distinguen
 * 'usuario inexistente' de 'contrasena incorrecta' y permiten enumerar cuentas
 * validas."
 */
const CREDENCIALES_INVALIDAS = () =>
  new ErrorNegocio(
    'CREDENCIALES_INVALIDAS',
    'Correo o contrasena incorrectos.',
    HttpStatus.UNAUTHORIZED,
  );

export type ResultadoLogin =
  | { readonly resultado: 'autenticado'; readonly usuario: { id: string; correo: string; nombre: string } }
  | { readonly resultado: 'mfa-requerido'; readonly desafio: string; readonly expiraEn: number };

@Injectable()
export class AutenticacionService {
  private readonly logger = new Logger(AutenticacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contrasenas: ContrasenaService,
    private readonly sesiones: SesionService,
    private readonly mfa: MfaService,
    private readonly limites: LimiteIntentosService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
    @Inject(TOKEN_REDIS) private readonly redis: Redis,
    @Inject(TOKEN_ENTORNO) private readonly entorno: Entorno,
  ) {}

  /**
   * Primer paso de autenticacion (RF-001).
   *
   * El orden de las operaciones importa y no es arbitrario:
   *
   *   1. Limite de intentos, ANTES de tocar la base. Evita que cada intento
   *      automatizado nos cueste una derivacion Argon2 completa.
   *   2. Busqueda del usuario.
   *   3. Verificacion, con senuelo si el usuario no existe, para que el tiempo
   *      no delate su ausencia.
   *   4. Piso de latencia uniforme en TODAS las salidas de fallo.
   */
  async iniciarSesion(
    correo: string,
    contrasena: string,
    res: Response,
  ): Promise<ResultadoLogin> {
    const inicio = Date.now();
    const ip = contextoActual()?.ip ?? null;

    const veredicto = await this.limites.evaluar(correo, ip);

    if (!veredicto.permitido) {
      await this.registrarIntento(null, correo, false);
      await this.limites.igualarLatencia(inicio);
      throw new ErrorNegocio(
        'DEMASIADOS_INTENTOS',
        'Demasiados intentos. Intenta de nuevo mas tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Retardo progresivo. Se aplica antes de responder, no despues de fallar,
    // para que tambien encarezca el intento que va a tener exito por azar.
    if (veredicto.retardoMs > 0) {
      await new Promise((r) => setTimeout(r, veredicto.retardoMs));
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { correo },
      select: {
        id: true,
        correo: true,
        contrasenaHash: true,
        activo: true,
        perfil: { select: { nombre: true, apellidoPaterno: true } },
      },
    });

    const valida = usuario
      ? await this.contrasenas.verificar(usuario.contrasenaHash, contrasena)
      : await this.contrasenas.verificarSenuelo(contrasena);

    // Una cuenta desactivada se trata igual que una credencial incorrecta: si
    // respondiera algo distinto, seria posible averiguar que cuentas existen
    // pero estan dadas de baja.
    if (!usuario || !valida || !usuario.activo) {
      await this.limites.registrarFallo(correo, ip);
      await this.registrarIntento(usuario?.id ?? null, correo, false);
      await this.limites.igualarLatencia(inicio);
      throw CREDENCIALES_INVALIDAS();
    }

    await this.limites.registrarExito(correo);
    await this.registrarIntento(usuario.id, correo, true);

    const nombre = usuario.perfil
      ? `${usuario.perfil.nombre} ${usuario.perfil.apellidoPaterno}`
      : usuario.correo;

    // --- Segundo factor ---------------------------------------------------
    const mfaActivo = await this.mfa.estaActivo(usuario.id);

    if (mfaActivo) {
      // No se emite sesion todavia. Un desafio de vida corta en Redis: si se
      // entregara la sesion aqui y se pidiera el codigo despues, el segundo
      // factor seria decorativo, porque la cookie ya estaria en el navegador.
      const desafio = randomBytes(32).toString('base64url');
      await this.redis.setex(`sc:desafio-mfa:${desafio}`, 300, usuario.id);
      return { resultado: 'mfa-requerido', desafio, expiraEn: 300 };
    }

    const rolesObligados = await this.rolesDelUsuario(usuario.id);
    if (this.mfa.esObligatorioPara(rolesObligados)) {
      // El rol exige MFA (RF-003) y la cuenta no lo tiene configurado. Se
      // permite entrar, pero la sesion queda marcada sin MFA verificada: las
      // politicas con `exigeMfa` la rechazaran hasta que lo configure.
      this.logger.warn(
        { usuarioId: usuario.id },
        'Cuenta con rol que exige MFA pero sin segundo factor configurado',
      );
    }

    await this.emitirSesion(usuario.id, usuario.correo, res, false);
    return { resultado: 'autenticado', usuario: { id: usuario.id, correo: usuario.correo, nombre } };
  }

  /** Segundo paso: verificacion del codigo TOTP. */
  async verificarMfa(desafio: string, codigo: string, res: Response): Promise<ResultadoLogin> {
    const inicio = Date.now();
    const clave = `sc:desafio-mfa:${desafio}`;
    const usuarioId = await this.redis.get(clave);

    if (!usuarioId) {
      await this.limites.igualarLatencia(inicio);
      throw CREDENCIALES_INVALIDAS();
    }

    const valido = await this.mfa.verificarCodigo(usuarioId, codigo);
    if (!valido) {
      await this.limites.igualarLatencia(inicio);
      throw CREDENCIALES_INVALIDAS();
    }

    // El desafio se consume: un codigo TOTP sigue siendo valido durante su
    // ventana, y sin esto el mismo desafio serviria para abrir varias sesiones.
    await this.redis.del(clave);

    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: {
        id: true,
        correo: true,
        perfil: { select: { nombre: true, apellidoPaterno: true } },
      },
    });

    await this.emitirSesion(usuario.id, usuario.correo, res, true);

    return {
      resultado: 'autenticado',
      usuario: {
        id: usuario.id,
        correo: usuario.correo,
        nombre: usuario.perfil
          ? `${usuario.perfil.nombre} ${usuario.perfil.apellidoPaterno}`
          : usuario.correo,
      },
    };
  }

  /**
   * Emite la sesion y detecta acceso desde dispositivo no habitual.
   *
   * La sesion SIEMPRE es nueva (RNFS-013). No hay ninguna ruta de codigo que
   * reutilice un identificador previo, de modo que la fijacion de sesion no es
   * representable.
   */
  private async emitirSesion(
    usuarioId: string,
    correo: string,
    res: Response,
    mfaVerificada: boolean,
  ): Promise<void> {
    const contexto = contextoActual();
    const huella = huellaDispositivo(contexto?.ip, contexto?.userAgent);

    const conocido = await this.prisma.sesion.findFirst({
      where: { usuarioId, huellaDispositivo: huella },
      select: { id: true },
    });

    const { token, expiraEl } = await this.prisma.$transaction(async (tx) => {
      const creada = await this.sesiones.crear(tx, usuarioId, {
        mfaVerificada,
        huellaDispositivo: huella,
      });

      await this.auditoria.registrar(tx, {
        accion: 'sesion.inicio',
        tipoRecurso: 'sesion',
        recursoId: creada.sesionId,
        resultado: 'exito',
        actorId: usuarioId,
        actorCorreo: correo,
        despues: { mfaVerificada, dispositivoConocido: Boolean(conocido) },
      });

      return creada;
    });

    this.sesiones.escribirCookie(res, token, expiraEl);

    // RF-091: notificar accesos desde dispositivos o ubicaciones no habituales.
    // Es deteccion, no prevencion: el acceso ya ocurrio. Su valor esta en que
    // el titular pueda reaccionar, que es la unica defensa contra una
    // credencial ya comprometida.
    if (!conocido) {
      await this.notificaciones.encolar({
        destinatarioId: usuarioId,
        tipo: 'acceso-inusual',
        canal: 'correo',
        titulo: 'Nuevo inicio de sesion en SecureCampus',
        cuerpo:
          'Se inicio sesion en tu cuenta desde un dispositivo que no habiamos ' +
          'visto antes. Si no fuiste tu, cambia tu contrasena de inmediato: ' +
          'eso cerrara todas las sesiones activas.',
        claveIdempotencia: `acceso-inusual:${usuarioId}:${huella}`,
      });
    }
  }

  /** Cierre de sesion (RF-002): revocacion en servidor, no solo borrar cookie. */
  async cerrarSesion(usuarioId: string, sesionIdPublico: string, res: Response): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.sesiones.revocar(tx, sesionIdPublico, usuarioId, 'cierre-solicitado');
      await this.auditoria.registrar(tx, {
        accion: 'sesion.cierre',
        tipoRecurso: 'sesion',
        recursoId: sesionIdPublico,
        resultado: 'exito',
        actorId: usuarioId,
      });
    });

    this.sesiones.borrarCookie(res);
  }

  /**
   * Cambio de contrasena autenticado (RF-005, RNFS-014).
   *
   * Exige la contrasena actual: sin eso, una sesion robada bastaria para tomar
   * la cuenta de forma permanente. Y revoca todas las sesiones al terminar,
   * incluida la que hizo el cambio — el usuario vuelve a entrar, que es
   * molesto pero es exactamente lo que expulsa a un intruso.
   */
  async cambiarContrasena(
    usuarioId: string,
    correo: string,
    actual: string,
    nueva: string,
    res: Response,
  ): Promise<void> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { contrasenaHash: true },
    });

    if (!(await this.contrasenas.verificar(usuario.contrasenaHash, actual))) {
      throw CREDENCIALES_INVALIDAS();
    }

    const hashNuevo = await this.contrasenas.derivar(nueva);

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { contrasenaHash: hashNuevo },
      });

      const revocadas = await this.sesiones.revocarTodas(tx, usuarioId, 'cambio-de-contrasena');

      await this.auditoria.registrar(tx, {
        accion: 'contrasena.cambio',
        tipoRecurso: 'usuario',
        recursoId: usuarioId,
        resultado: 'exito',
        actorId: usuarioId,
        actorCorreo: correo,
        despues: { sesionesRevocadas: revocadas },
      });
    });

    this.sesiones.borrarCookie(res);

    await this.notificaciones.encolar({
      destinatarioId: usuarioId,
      tipo: 'contrasena-cambiada',
      canal: 'correo',
      titulo: 'Tu contrasena cambio',
      cuerpo:
        'La contrasena de tu cuenta se modifico y todas las sesiones activas ' +
        'se cerraron. Si no fuiste tu, comunicate con soporte de inmediato.',
      claveIdempotencia: `contrasena-cambiada:${usuarioId}:${Date.now()}`,
    });
  }

  private async rolesDelUsuario(usuarioId: string): Promise<string[]> {
    const ahora = new Date();
    const asignaciones = await this.prisma.asignacionRol.findMany({
      where: {
        usuarioId,
        revocadaEl: null,
        desdeEl: { lte: ahora },
        OR: [{ hastaEl: null }, { hastaEl: { gt: ahora } }],
      },
      select: { rol: { select: { clave: true } } },
    });
    return asignaciones.map((a) => a.rol.clave);
  }

  /**
   * Deja constancia del intento en Postgres.
   *
   * Redis lleva el contador que decide el bloqueo, pero expira. Esta tabla es
   * la evidencia, y la evidencia no debe expirar: SC-LAB-003 §6 senala que "la
   * capacidad de saber que paso se decide antes o no existe... los logs que no
   * se configuraron no se pueden consultar retroactivamente".
   */
  private async registrarIntento(
    usuarioId: string | null,
    correo: string,
    exitoso: boolean,
  ): Promise<void> {
    const contexto = contextoActual();
    try {
      await this.prisma.intentoAutenticacion.create({
        data: {
          usuarioId,
          correo: correo.slice(0, 254),
          exitoso,
          ip: contexto?.ip ?? null,
          userAgent: contexto?.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error({ error }, 'No se pudo registrar el intento de autenticacion');
    }
  }
}

/**
 * Huella del dispositivo.
 *
 * Es deliberadamente gruesa: red y navegador, nada mas. No pretende
 * identificar de forma unica a nadie —eso seria rastreo, y ademas se rompe con
 * cualquier actualizacion del navegador— sino distinguir "el equipo de
 * siempre" de "uno que no habiamos visto", que es lo que la alerta necesita.
 */
function huellaDispositivo(ip?: string | null, userAgent?: string | null): string {
  const red = (ip ?? 'sin-ip').split('.').slice(0, 2).join('.');
  const navegador = (userAgent ?? 'sin-ua').slice(0, 80);
  return Buffer.from(`${red}|${navegador}`).toString('base64url').slice(0, 64);
}
