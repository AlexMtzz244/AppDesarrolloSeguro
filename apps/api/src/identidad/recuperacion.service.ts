import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { contextoActual } from '../comun/correlacion.js';
import { PrismaService } from '../comun/prisma.service.js';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { ContrasenaService } from './contrasena.service.js';
import { SesionService } from './sesion.service.js';

/**
 * Recuperacion de cuenta — RF-010 reescrito (SC-SRS-001 §5).
 *
 * Este servicio es el caso guiado de SC-LAB-003 §3 convertido en codigo. El
 * requisito original —"permitir al usuario recuperar su contrasena"— se
 * cumplia al cien por ciento con un enlace de siete dias reutilizable. El
 * problema no era que el sistema hiciera algo mal, era que hacia **de mas**, y
 * ese exceso nunca se evaluo porque nadie escribio cual era el limite.
 *
 * Los siete criterios que faltaban estan aqui, y cada uno esta anotado con su
 * letra del laboratorio:
 *
 *   (a) vigencia corta         -> `RECUPERACION_VIGENCIA_MINUTOS`, acotada a 15-30
 *   (b) un solo uso            -> `usadoEl` + invalidacion del anterior
 *   (c) token imprevisible     -> CSPRNG, guardado solo como hash
 *   (d) respuesta uniforme     -> `solicitar` devuelve siempre lo mismo
 *   (e) limite de solicitudes  -> `RECUPERACION_MAX_SOLICITUDES_HORA`
 *   (f) revocar sesiones       -> `revocarTodas` al completar
 *   (g) notificar al titular   -> al solicitar y al completar
 *
 * El laboratorio senala que (f) es el mas caro de agregar tarde: los otros
 * seis se resuelven dentro de este flujo, mientras que ese exige que el
 * sistema sepa enumerar y revocar sesiones, que es una decision de
 * arquitectura. Aqui se puede escribir en una linea precisamente porque esa
 * decision se tomo antes, en `SesionService`.
 */
@Injectable()
export class RecuperacionService {
  private readonly logger = new Logger(RecuperacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contrasenas: ContrasenaService,
    private readonly sesiones: SesionService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
    @Inject(TOKEN_ENTORNO) private readonly entorno: Entorno,
  ) {}

  /**
   * Solicita un enlace de recuperacion.
   *
   * **Siempre** termina sin error y sin devolver nada (criterio d). Ni el
   * valor de retorno, ni el codigo HTTP, ni el mensaje distinguen entre una
   * cuenta existente y una inexistente: lo contrario convertiria el formulario
   * en un enumerador de correos institucionales validos.
   */
  async solicitar(correo: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo },
      select: { id: true, correo: true, activo: true },
    });

    // Se audita el intento incluso cuando la cuenta no existe: una rafaga de
    // solicitudes contra correos inexistentes es exactamente la firma de
    // alguien probando que direcciones estan registradas.
    await this.auditoria.registrarFueraDeMutacion({
      accion: 'recuperacion.solicitud',
      tipoRecurso: 'usuario',
      recursoId: usuario?.id ?? null,
      resultado: usuario ? 'exito' : 'denegado',
      motivo: usuario ? null : 'cuenta-inexistente',
      actorCorreo: correo,
    });

    if (!usuario?.activo) return;

    // (e) Limite de solicitudes por cuenta.
    const haceUnaHora = new Date(Date.now() - 3_600_000);
    const recientes = await this.prisma.tokenRecuperacion.count({
      where: { usuarioId: usuario.id, creadoEl: { gte: haceUnaHora } },
    });
    if (recientes >= this.entorno.RECUPERACION_MAX_SOLICITUDES_HORA) {
      // Se corta en silencio: avisar "demasiadas solicitudes" revelaria que la
      // cuenta existe, deshaciendo el criterio (d).
      this.logger.warn({ usuarioId: usuario.id }, 'Limite de solicitudes de recuperacion');
      return;
    }

    // (c) Token imprevisible, del que se guarda solo el hash.
    const token = randomBytes(32).toString('base64url');
    const ahora = new Date();
    const expiraEl = new Date(
      ahora.getTime() + this.entorno.RECUPERACION_VIGENCIA_MINUTOS * 60_000,
    );

    await this.prisma.$transaction(async (tx) => {
      // (b) Emitir uno nuevo invalida los anteriores.
      const nuevo = await tx.tokenRecuperacion.create({
        data: {
          usuarioId: usuario.id,
          tokenHash: hashToken(token),
          expiraEl,
          ipSolicitud: contextoActual()?.ip ?? null,
        },
        select: { id: true },
      });

      await tx.tokenRecuperacion.updateMany({
        where: {
          usuarioId: usuario.id,
          id: { not: nuevo.id },
          usadoEl: null,
          invalidadoEl: null,
        },
        data: { invalidadoEl: ahora, invalidadoPorId: nuevo.id },
      });
    });

    // (g) Notificar al titular por un canal que no depende del enlace.
    await this.notificaciones.encolar({
      destinatarioId: usuario.id,
      tipo: 'recuperacion-solicitada',
      canal: 'correo',
      titulo: 'Solicitud de recuperacion de acceso',
      // El token NO va en el cuerpo de la notificacion registrada (RNFS-024).
      // Va solo en el correo que envia el consumidor de la cola, construido
      // a partir del token que se le pasa aparte y que no se persiste.
      cuerpo:
        'Recibimos una solicitud para restablecer el acceso a tu cuenta. ' +
        'Si no fuiste tu, ignora este mensaje y avisa a soporte.',
      claveIdempotencia: `recuperacion-solicitud:${usuario.id}:${ahora.toISOString()}`,
      enlaceToken: token,
    });
  }

  /**
   * Completa la recuperacion.
   *
   * Devuelve `true` o `false`; nunca detalla por que fallo. Un enlace vencido,
   * uno ya usado, uno sustituido y uno inventado producen exactamente la misma
   * respuesta (RNFS-023).
   */
  async completar(token: string, contrasenaNueva: string): Promise<boolean> {
    const ahora = new Date();

    const registro = await this.prisma.tokenRecuperacion.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        usuarioId: true,
        expiraEl: true,
        usadoEl: true,
        invalidadoEl: true,
        usuario: { select: { id: true, correo: true, activo: true } },
      },
    });

    if (
      !registro ||
      registro.usadoEl !== null ||
      registro.invalidadoEl !== null ||
      registro.expiraEl <= ahora ||
      !registro.usuario.activo
    ) {
      await this.auditoria.registrarFueraDeMutacion({
        accion: 'recuperacion.completada',
        tipoRecurso: 'usuario',
        recursoId: registro?.usuarioId ?? null,
        resultado: 'denegado',
        motivo: motivoRechazo(registro, ahora),
      });
      return false;
    }

    const hashNuevo = await this.contrasenas.derivar(contrasenaNueva);

    await this.prisma.$transaction(async (tx) => {
      // (b) Un solo uso. El filtro `usadoEl: null` dentro del UPDATE es lo que
      // cierra la condicion de carrera: dos peticiones simultaneas con el
      // mismo enlace no pueden ambas marcarlo.
      const consumido = await tx.tokenRecuperacion.updateMany({
        where: { id: registro.id, usadoEl: null },
        data: { usadoEl: ahora },
      });

      if (consumido.count !== 1) {
        throw new Error('token-consumido-concurrentemente');
      }

      await tx.usuario.update({
        where: { id: registro.usuarioId },
        data: { contrasenaHash: hashNuevo },
      });

      // (f) El criterio mas caro de agregar tarde, y aqui es una linea.
      await this.sesiones.revocarTodas(tx, registro.usuarioId, 'recuperacion-de-cuenta');

      await this.auditoria.registrar(tx, {
        accion: 'recuperacion.completada',
        tipoRecurso: 'usuario',
        recursoId: registro.usuarioId,
        resultado: 'exito',
        actorId: registro.usuarioId,
        actorCorreo: registro.usuario.correo,
      });
    });

    // (g) Notificar tambien al completar: si la recuperacion no la pidio el
    // titular, este es el aviso que le permite reaccionar.
    await this.notificaciones.encolar({
      destinatarioId: registro.usuarioId,
      tipo: 'recuperacion-completada',
      canal: 'correo',
      titulo: 'Tu contrasena fue restablecida',
      cuerpo:
        'La contrasena de tu cuenta se restablecio y todas las sesiones ' +
        'activas se cerraron. Si no fuiste tu, comunicate con soporte de inmediato.',
      claveIdempotencia: `recuperacion-completada:${registro.id}`,
    });

    return true;
  }
}

function motivoRechazo(
  registro: { expiraEl: Date; usadoEl: Date | null; invalidadoEl: Date | null } | null,
  ahora: Date,
): string {
  if (!registro) return 'token-inexistente';
  if (registro.usadoEl) return 'token-ya-usado';
  if (registro.invalidadoEl) return 'token-sustituido';
  if (registro.expiraEl <= ahora) return 'token-vencido';
  return 'cuenta-inactiva';
}

/**
 * SHA-256 del token.
 *
 * Como en las sesiones, basta un hash rapido: 256 bits de entropia no se
 * adivinan. Lo que este hash evita es que un volcado de la base entregue
 * enlaces de recuperacion utilizables (RNFS-021).
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
