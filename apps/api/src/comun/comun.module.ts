import { Global, Module, type Provider } from '@nestjs/common';
import { cargarEntorno, TOKEN_ENTORNO } from '../config/entorno.js';
import { PrismaService } from './prisma.service.js';
import { proveedorRedis } from './redis.provider.js';

const proveedorEntorno: Provider = {
  provide: TOKEN_ENTORNO,
  // Se ejecuta al construir el contenedor de dependencias. Si la
  // configuracion es invalida, `cargarEntorno` termina el proceso antes de
  // que ningun modulo llegue a inicializarse (RNFS-052).
  useFactory: () => cargarEntorno(),
};

/**
 * Infraestructura compartida: configuracion validada, base de datos y Redis.
 *
 * Es `@Global()` porque estas tres piezas las necesita practicamente todo
 * modulo del sistema, y repetir sus proveedores en cada uno multiplicaria las
 * instancias —dos pools de conexiones a Postgres, dos clientes de Redis— sin
 * ganar nada.
 */
@Global()
@Module({
  providers: [proveedorEntorno, proveedorRedis, PrismaService],
  exports: [TOKEN_ENTORNO, proveedorRedis, PrismaService],
})
export class ComunModule {}
