import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';
import { TOKEN_REDIS } from '../comun/redis.provider.js';

export interface VeredictoIntento {
  readonly permitido: boolean;
  readonly exigeCaptcha: boolean;
  readonly retardoMs: number;
  readonly intentosCuenta: number;
  readonly intentosOrigen: number;
}

/**
 * Limite de intentos de autenticacion (RNFS-015).
 *
 * # Por que dos contadores y no uno
 *
 * SC-LAB-002 escenario D lo explica mejor que cualquier comentario: "Cien
 * intentos contra una cuenta son visibles; el mismo atacante repartiendo un
 * intento por cuenta sobre diez mil cuentas (*password spraying*) no dispara
 * ningun contador por cuenta, y solo el limite por origen lo alcanza."
 *
 * Son dos ataques distintos y necesitan dos contadores distintos:
 *   - por cuenta, contra fuerza bruta y credential stuffing dirigido;
 *   - por origen, contra spraying distribuido entre muchas cuentas.
 *
 * Y ambos se repiten en el borde (WAF o proxy inverso), porque un atacante con
 * miles de direcciones supera el limite por IP de la aplicacion.
 *
 * # Ventana deslizante, no fija
 *
 * Con una ventana fija de 15 minutos, un atacante que agota el limite espera
 * al cambio de ventana y vuelve a tener el cupo completo, duplicando su ritmo
 * justo en la frontera. La lista ordenada de Redis con marcas de tiempo evita
 * ese salto.
 */
@Injectable()
export class LimiteIntentosService {
  private readonly logger = new Logger(LimiteIntentosService.name);

  constructor(
    @Inject(TOKEN_REDIS) private readonly redis: Redis,
    @Inject(TOKEN_ENTORNO) private readonly entorno: Entorno,
  ) {}

  private clave(tipo: 'cuenta' | 'origen', valor: string): string {
    return `sc:intentos:${tipo}:${valor.toLowerCase()}`;
  }

  /** Cuenta los intentos de la ventana sin registrar uno nuevo. */
  private async contarEnVentana(clave: string): Promise<number> {
    const ahora = Date.now();
    const inicio = ahora - this.entorno.LOGIN_VENTANA_MINUTOS * 60_000;
    await this.redis.zremrangebyscore(clave, 0, inicio);
    return this.redis.zcard(clave);
  }

  /**
   * Evalua si el intento procede, ANTES de tocar la base de datos.
   *
   * Consultar primero el limite evita que un ataque automatizado convierta
   * cada intento en una derivacion Argon2 completa, que es cara a proposito y
   * se volveria una via de denegacion de servicio contra nosotros mismos.
   */
  async evaluar(correo: string, ip: string | null): Promise<VeredictoIntento> {
    const intentosCuenta = await this.contarEnVentana(this.clave('cuenta', correo));
    const intentosOrigen = ip ? await this.contarEnVentana(this.clave('origen', ip)) : 0;

    const excedeCuenta = intentosCuenta >= this.entorno.LOGIN_MAX_INTENTOS_CUENTA;
    const excedeOrigen = intentosOrigen >= this.entorno.LOGIN_MAX_INTENTOS_IP;

    // Retardo progresivo. Crece de forma exponencial pero con techo, porque un
    // retardo ilimitado seria una denegacion de servicio contra el usuario
    // legitimo que simplemente se equivoco varias veces.
    const fallosRelevantes = Math.max(intentosCuenta, 0);
    const retardoMs = Math.min(
      this.entorno.LOGIN_RETARDO_BASE_MS * 2 ** Math.min(fallosRelevantes, 6),
      8_000,
    );

    return {
      permitido: !excedeCuenta && !excedeOrigen,
      exigeCaptcha:
        this.entorno.CAPTCHA_PROVEEDOR !== 'ninguno' &&
        intentosCuenta >= this.entorno.LOGIN_UMBRAL_CAPTCHA,
      retardoMs,
      intentosCuenta,
      intentosOrigen,
    };
  }

  /** Registra un intento fallido en ambos contadores. */
  async registrarFallo(correo: string, ip: string | null): Promise<void> {
    const ahora = Date.now();
    const ttl = this.entorno.LOGIN_VENTANA_MINUTOS * 60;
    const miembro = `${ahora}:${Math.random().toString(36).slice(2, 10)}`;

    const tuberia = this.redis.pipeline();
    const claveCuenta = this.clave('cuenta', correo);
    tuberia.zadd(claveCuenta, ahora, miembro);
    tuberia.expire(claveCuenta, ttl);

    if (ip) {
      const claveOrigen = this.clave('origen', ip);
      tuberia.zadd(claveOrigen, ahora, miembro);
      tuberia.expire(claveOrigen, ttl);
    }

    await tuberia.exec();
  }

  /**
   * Limpia el contador de la cuenta tras un acceso exitoso.
   *
   * El contador por origen NO se limpia a proposito. Si se limpiara, un
   * atacante con una sola credencial valida podria intercalar un acceso
   * correcto cada pocos intentos y resetear su propio limite indefinidamente.
   */
  async registrarExito(correo: string): Promise<void> {
    await this.redis.del(this.clave('cuenta', correo));
  }

  /**
   * Espera hasta completar el piso de latencia uniforme (RNFS-016).
   *
   * Se invoca en TODAS las respuestas de autenticacion fallida, exista la
   * cuenta o no. Sin esto, el tiempo de respuesta revela por si solo que
   * correos estan registrados, aunque el mensaje sea identico.
   */
  async igualarLatencia(inicioMs: number): Promise<void> {
    const transcurrido = Date.now() - inicioMs;
    const restante = this.entorno.LOGIN_LATENCIA_MINIMA_MS - transcurrido;
    if (restante > 0) {
      await new Promise((resolver) => setTimeout(resolver, restante));
    }
  }
}
