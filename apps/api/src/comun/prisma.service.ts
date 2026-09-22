import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente de base de datos.
 *
 * Se conecta con el rol de aplicacion, que **no tiene** UPDATE ni DELETE sobre
 * `evento_auditoria` (RNFS-031). Esa restriccion no esta aqui: esta en la
 * migracion y en el usuario de la cadena de conexion, que es donde un atacante
 * con control del codigo no la puede quitar.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * Cliente dentro de una transaccion.
 *
 * Este tipo es el mecanismo central de RNFS-030. `ServicioAuditoria.registrar`
 * lo exige en su firma, de modo que **no se puede** escribir un evento fuera
 * de una transaccion: no es una convencion que haya que recordar, es que el
 * codigo no compila de la otra forma.
 *
 * Es la misma idea que SC-LAB-002 §5 clasifica como *security by design*: "no
 * es una validacion agregada, es la estructura la que impide expresar el
 * acceso inseguro".
 */
export type ClienteTransaccion = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
