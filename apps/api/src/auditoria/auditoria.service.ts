import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccionAuditable, ResultadoAuditoria } from '@securecampus/contracts';
import { contextoActual, correlationIdActual } from '../comun/correlacion.js';
import type { ClienteTransaccion } from '../comun/prisma.service.js';
import { PrismaService } from '../comun/prisma.service.js';

export interface DatosEvento {
  readonly accion: AccionAuditable;
  readonly tipoRecurso: string;
  readonly recursoId?: string | null;
  readonly resultado: ResultadoAuditoria;
  readonly motivo?: string | null;
  readonly antes?: unknown;
  readonly despues?: unknown;
  /** Se toma del contexto de la peticion cuando no se indica. */
  readonly actorId?: string | null;
  readonly actorCorreo?: string | null;
}

/**
 * Bitacora append-only (RNFS-030 a RNFS-033).
 *
 * # Por que `registrar` exige el cliente transaccional
 *
 * La firma pide un `ClienteTransaccion`, que solo se obtiene dentro de
 * `prisma.$transaction(...)`. La consecuencia es que **no existe forma de
 * escribir un evento fuera de una transaccion**: no es una convencion que
 * haya que recordar en cada servicio, es que el codigo no compila de la otra
 * manera.
 *
 * Eso es lo que hace cierto el requisito "toda mutacion sensible y su evento
 * ocurren en la misma transaccion". Si la mutacion falla y la transaccion se
 * revierte, el evento se revierte con ella; si el evento falla, la mutacion no
 * queda. Nunca hay un cambio sin bitacora ni una bitacora sin cambio.
 *
 * SC-LAB-002 §5 llama a esto *security by design*: la estructura impide
 * expresar el comportamiento inseguro, en vez de confiar en que nadie lo
 * escriba.
 *
 * # Por que no hay metodos de actualizar o borrar
 *
 * Porque no debe haberlos (RF-081). Y no es la unica capa: la API no los
 * expone, el rol de base de datos no tiene el permiso (RNFS-031) y un trigger
 * los rechaza. Que este servicio no los ofrezca es solo la primera.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(tx: ClienteTransaccion, datos: DatosEvento): Promise<void> {
    const contexto = contextoActual();

    await tx.eventoAuditoria.create({
      data: {
        accion: datos.accion,
        tipoRecurso: datos.tipoRecurso,
        recursoId: datos.recursoId ?? null,
        resultado: datos.resultado,
        motivo: datos.motivo ?? null,
        // `Prisma.DbNull` escribe NULL en la columna; `null` a secas seria el
        // valor JSON `null`, que es un dato distinto y confundiria a quien
        // lea la bitacora despues.
        antes: sanear(datos.antes) ?? Prisma.DbNull,
        despues: sanear(datos.despues) ?? Prisma.DbNull,
        actorId: datos.actorId ?? contexto?.actorId ?? null,
        actorCorreo: datos.actorCorreo ?? contexto?.actorCorreo ?? null,
        ip: contexto?.ip ?? null,
        userAgent: contexto?.userAgent ?? null,
        correlationId: correlationIdActual(),
      },
    });
  }

  /**
   * Registra un evento que **no** acompana a una mutacion: accesos denegados,
   * lecturas auditables, intentos fallidos.
   *
   * Abre su propia transaccion porque no hay ninguna a la cual sumarse. El
   * nombre es distinto a proposito: si se llamara igual que `registrar`,
   * seria comodo usarlo por descuido junto a una mutacion y se perderia la
   * atomicidad que este modulo existe para garantizar.
   */
  async registrarFueraDeMutacion(datos: DatosEvento): Promise<void> {
    try {
      await this.prisma.$transaction((tx) => this.registrar(tx, datos));
    } catch (error) {
      // Un fallo al auditar un acceso denegado no debe convertir un 403 en un
      // 500 — eso le diria al atacante que algo distinto ocurrio. Se degrada
      // al log tecnico, que es la unica red que queda.
      this.logger.error(
        { error, accion: datos.accion, correlationId: correlationIdActual() },
        'No se pudo escribir el evento de auditoria',
      );
    }
  }
}

/**
 * Quita del `antes`/`despues` lo que nunca debe quedar registrado.
 *
 * La bitacora se consulta y se exporta (RF-080), asi que es un lugar donde los
 * secretos se propagan con facilidad. RNFS-024 prohibe expresamente que el
 * token de recuperacion aparezca en logs; esto lo generaliza a cualquier campo
 * con forma de credencial.
 */
const CLAVES_PROHIBIDAS = [
  'contrasena',
  'contrasenahash',
  'password',
  'token',
  'tokenhash',
  'secreto',
  'secretocifrado',
  'codigohash',
  'codigorecuperacion',
  'authorization',
  'cookie',
];

function sanear(valor: unknown): object | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'object') return { valor };

  const salida: Record<string, unknown> = {};
  for (const [clave, contenido] of Object.entries(valor as Record<string, unknown>)) {
    const normalizada = clave.toLowerCase().replace(/[_-]/g, '');
    if (CLAVES_PROHIBIDAS.some((p) => normalizada.includes(p))) {
      salida[clave] = '[omitido]';
      continue;
    }
    salida[clave] =
      contenido && typeof contenido === 'object' && !(contenido instanceof Date)
        ? sanear(contenido)
        : contenido;
  }
  return salida;
}
