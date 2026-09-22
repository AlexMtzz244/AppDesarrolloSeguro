import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { ROLES_CON_MFA_OBLIGATORIO, type RolBase } from '@securecampus/contracts';
import type { ClienteTransaccion } from '../comun/prisma.service.js';
import { PrismaService } from '../comun/prisma.service.js';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';

/**
 * Segundo factor TOTP (RF-003, RF-004, RNFS-017).
 *
 * SC-LAB-001 escenario 3 argumenta por que se invierte aqui el esfuerzo que no
 * se gasta en rotacion periodica de contrasenas: el MFA corta el credential
 * stuffing incluso cuando la credencial ya esta filtrada, que es el caso que
 * ninguna politica de contrasenas resuelve.
 *
 * El secreto se cifra en reposo con AES-256-GCM. Se elige GCM y no CBC porque
 * es cifrado autenticado: si alguien altera el texto cifrado en la base, el
 * descifrado falla en vez de producir un secreto distinto y silenciosamente
 * incorrecto.
 */
@Injectable()
export class MfaService {
  private readonly clave: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOKEN_ENTORNO) entorno: Entorno,
  ) {
    // La clave se deriva por SHA-256 para admitir cualquier longitud de la
    // variable de entorno y seguir entregando los 32 bytes que exige AES-256.
    this.clave = createHash('sha256').update(entorno.MFA_CLAVE_CIFRADO).digest();

    // Una ventana de 1 acepta el codigo anterior y el siguiente (±30 s). Es el
    // margen minimo para tolerar relojes desfasados sin ampliar de forma
    // apreciable la ventana de reutilizacion de un codigo interceptado.
    authenticator.options = { window: 1 };
  }

  esObligatorioPara(roles: readonly string[]): boolean {
    return roles.some((r) => ROLES_CON_MFA_OBLIGATORIO.includes(r as RolBase));
  }

  // --- Cifrado del secreto -------------------------------------------------

  private cifrar(textoPlano: string): {
    secretoCifrado: string;
    nonce: string;
    tagAutenticacion: string;
  } {
    const nonce = randomBytes(12);
    const cifrador = createCipheriv('aes-256-gcm', this.clave, nonce);
    const cifrado = Buffer.concat([cifrador.update(textoPlano, 'utf8'), cifrador.final()]);
    return {
      secretoCifrado: cifrado.toString('base64'),
      nonce: nonce.toString('base64'),
      tagAutenticacion: cifrador.getAuthTag().toString('base64'),
    };
  }

  private descifrar(datos: {
    secretoCifrado: string;
    nonce: string;
    tagAutenticacion: string;
  }): string {
    const descifrador = createDecipheriv(
      'aes-256-gcm',
      this.clave,
      Buffer.from(datos.nonce, 'base64'),
    );
    descifrador.setAuthTag(Buffer.from(datos.tagAutenticacion, 'base64'));
    return Buffer.concat([
      descifrador.update(Buffer.from(datos.secretoCifrado, 'base64')),
      descifrador.final(),
    ]).toString('utf8');
  }

  // --- Alta ----------------------------------------------------------------

  /**
   * Genera el secreto y lo guarda **sin activar**.
   *
   * La credencial queda inactiva hasta que el usuario demuestra, con un codigo
   * valido, que su aplicacion la registro bien. Activarla de inmediato dejaria
   * cuentas con un segundo factor que su duena no puede usar, y el remedio
   * habitual —desactivarlo desde soporte— es justo la via que un atacante
   * buscaria.
   */
  async iniciarAlta(
    tx: ClienteTransaccion,
    usuarioId: string,
    correo: string,
  ): Promise<{ secreto: string; uriOtpauth: string }> {
    const secreto = authenticator.generateSecret();
    const cifrado = this.cifrar(secreto);

    await tx.credencialTotp.upsert({
      where: { usuarioId },
      create: { usuarioId, ...cifrado },
      update: { ...cifrado, activadaEl: null, desactivadaEl: null },
    });

    return {
      secreto,
      uriOtpauth: authenticator.keyuri(correo, 'SecureCampus', secreto),
    };
  }

  /**
   * Confirma el alta y emite los codigos de recuperacion.
   *
   * Los codigos se devuelven en claro una sola vez y se guardan hasheados
   * (RNFS-017). Son credenciales completas: quien los tenga puede saltarse el
   * segundo factor, asi que se tratan como contrasenas.
   */
  async confirmarAlta(
    tx: ClienteTransaccion,
    usuarioId: string,
    codigo: string,
  ): Promise<{ codigosRecuperacion: string[] } | null> {
    const credencial = await tx.credencialTotp.findUnique({ where: { usuarioId } });
    if (!credencial) return null;

    const secreto = this.descifrar(credencial);
    if (!authenticator.verify({ token: codigo, secret: secreto })) return null;

    await tx.credencialTotp.update({
      where: { usuarioId },
      data: { activadaEl: new Date(), desactivadaEl: null },
    });

    // Se invalidan los codigos anteriores: reemitir sin borrar dejaria
    // credenciales antiguas vivas indefinidamente.
    await tx.codigoRecuperacionMfa.deleteMany({ where: { usuarioId } });

    const codigos = Array.from({ length: 10 }, () =>
      randomBytes(6).toString('hex').toUpperCase(),
    );

    await tx.codigoRecuperacionMfa.createMany({
      data: codigos.map((c) => ({ usuarioId, codigoHash: hashCodigo(c) })),
    });

    return { codigosRecuperacion: codigos };
  }

  // --- Verificacion --------------------------------------------------------

  async verificarCodigo(usuarioId: string, codigo: string): Promise<boolean> {
    const credencial = await this.prisma.credencialTotp.findUnique({
      where: { usuarioId },
      select: {
        secretoCifrado: true,
        nonce: true,
        tagAutenticacion: true,
        activadaEl: true,
        desactivadaEl: true,
      },
    });

    if (!credencial?.activadaEl || credencial.desactivadaEl) return false;

    try {
      return authenticator.verify({
        token: codigo,
        secret: this.descifrar(credencial),
      });
    } catch {
      return false;
    }
  }

  /**
   * Consume un codigo de recuperacion.
   *
   * Es de un solo uso: se marca `usadoEl` en la misma consulta que lo
   * encuentra, mediante `updateMany` con el filtro `usadoEl: null`. Buscar
   * primero y marcar despues abriria una condicion de carrera en la que dos
   * peticiones simultaneas consumirian el mismo codigo.
   */
  async consumirCodigoRecuperacion(
    tx: ClienteTransaccion,
    usuarioId: string,
    codigo: string,
  ): Promise<boolean> {
    const resultado = await tx.codigoRecuperacionMfa.updateMany({
      where: {
        usuarioId,
        codigoHash: hashCodigo(codigo.trim().toUpperCase()),
        usadoEl: null,
      },
      data: { usadoEl: new Date() },
    });
    return resultado.count === 1;
  }

  async estaActivo(usuarioId: string): Promise<boolean> {
    const credencial = await this.prisma.credencialTotp.findUnique({
      where: { usuarioId },
      select: { activadaEl: true, desactivadaEl: true },
    });
    return Boolean(credencial?.activadaEl && !credencial.desactivadaEl);
  }
}

function hashCodigo(codigo: string): string {
  return createHash('sha256').update(codigo).digest('hex');
}
