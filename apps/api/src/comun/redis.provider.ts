import { Logger, type Provider } from '@nestjs/common';
import { Redis } from 'ioredis';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';

export const TOKEN_REDIS = Symbol('REDIS');

/**
 * Conexion a Redis.
 *
 * Redis lleva el estado volatil: contadores de intentos, desafios de MFA y las
 * colas de BullMQ. Nada de lo que vive aqui es evidencia: si Redis se pierde,
 * el sistema sigue funcionando y los contadores empiezan de cero.
 *
 * La evidencia —intentos de autenticacion, eventos de auditoria— va a
 * Postgres. La distincion importa: SC-LAB-003 §6 senala que "los logs que no
 * se configuraron no se pueden consultar retroactivamente" y es el unico dano
 * literalmente irrecuperable. Un contador que expira es aceptable; una
 * bitacora que expira, no.
 */
export const proveedorRedis: Provider = {
  provide: TOKEN_REDIS,
  inject: [TOKEN_ENTORNO],
  useFactory: (entorno: Entorno): Redis => {
    const logger = new Logger('Redis');
    const cliente = new Redis(entorno.REDIS_URL, {
      maxRetriesPerRequest: null, // Requisito de BullMQ.
      lazyConnect: false,
    });

    cliente.on('error', (error) => logger.error({ error }, 'Error de conexion con Redis'));
    cliente.on('connect', () => logger.log('Conectado a Redis'));

    return cliente;
  },
};
