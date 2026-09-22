/**
 * Prepara la base de datos para las pruebas de integracion en CI.
 *
 * Reproduce lo que en desarrollo hace `infra/postgres/init/01-rol-aplicacion.sh`:
 * crea el rol de aplicacion con privilegio minimo ANTES de migrar, para que el
 * REVOKE de la migracion tenga a quien revocarle el permiso.
 *
 * Sin este paso, la prueba negativa 12 pasaria en verde sin verificar nada: la
 * aplicacion correria como propietaria de la base y el REVOKE no se le habria
 * aplicado a nadie. Un control que se prueba contra un entorno donde no esta
 * activo no es un control probado.
 */
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Valida un identificador de Postgres antes de interpolarlo.
 *
 * Estas cadenas vienen de variables de entorno de CI, no de un usuario, pero
 * interpolarlas sin comprobar seria exactamente el patron que el proyecto
 * entero evita. Una lista blanca estricta cuesta tres lineas.
 */
function identificadorSeguro(valor: string, nombre: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(valor)) {
    throw new Error(`${nombre} no es un identificador valido de Postgres: ${valor}`);
  }
  return valor;
}

async function main(): Promise<void> {
  const urlPropietario = process.env['DATABASE_URL_MIGRACIONES'];
  const usuarioApp = process.env['POSTGRES_APP_USER'];
  const contrasenaApp = process.env['POSTGRES_APP_PASSWORD'];

  if (!urlPropietario || !usuarioApp || !contrasenaApp) {
    throw new Error(
      'Faltan DATABASE_URL_MIGRACIONES, POSTGRES_APP_USER o POSTGRES_APP_PASSWORD.',
    );
  }

  const app = identificadorSeguro(usuarioApp, 'POSTGRES_APP_USER');
  const url = new URL(urlPropietario);
  const nombreBd = identificadorSeguro(url.pathname.replace('/', ''), 'nombre de la base');
  const propietarioBd = identificadorSeguro(url.username, 'usuario propietario');

  const propietario = new PrismaClient({ datasources: { db: { url: urlPropietario } } });

  await propietario.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${app}') THEN
        CREATE ROLE ${app} WITH LOGIN PASSWORD '${contrasenaApp.replace(/'/g, "''")}'
          NOSUPERUSER NOCREATEDB NOCREATEROLE;
      END IF;
    END
    $$;
  `);

  await propietario.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${nombreBd}" TO ${app}`);
  await propietario.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${app}`);
  await propietario.$executeRawUnsafe(`
    ALTER DEFAULT PRIVILEGES FOR ROLE ${propietarioBd} IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${app}
  `);
  await propietario.$disconnect();

  console.log(`Rol ${app} creado con privilegio minimo. Aplicando migraciones...`);
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  const segundaPasada = new PrismaClient({ datasources: { db: { url: urlPropietario } } });

  // Los privilegios por omision solo aplican a las tablas FUTURAS; las que
  // acaba de crear la migracion necesitan el GRANT explicito.
  await segundaPasada.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${app}`,
  );

  // Y hay que volver a restringir la bitacora: ese GRANT masivo le acaba de
  // devolver el UPDATE y el DELETE que la migracion le habia quitado. El orden
  // importa, y equivocarlo dejaria RNFS-031 sin efecto en CI.
  await segundaPasada.$executeRawUnsafe(
    `REVOKE UPDATE, DELETE, TRUNCATE ON evento_auditoria FROM ${app}`,
  );

  // Comprobacion explicita: si el REVOKE no quedo, la prueba negativa 12
  // pasaria en verde sin verificar nada. Mejor fallar aqui, ruidosamente.
  const privilegios = await segundaPasada.$queryRawUnsafe<{ privilege_type: string }[]>(`
    SELECT privilege_type FROM information_schema.table_privileges
    WHERE grantee = '${app}' AND table_name = 'evento_auditoria'
  `);

  const tipos = privilegios.map((p) => p.privilege_type);
  if (tipos.includes('UPDATE') || tipos.includes('DELETE')) {
    throw new Error(
      `El rol ${app} conserva UPDATE/DELETE sobre evento_auditoria. ` +
        'RNFS-031 no esta activo y las pruebas de auditoria no serian validas.',
    );
  }

  await segundaPasada.$disconnect();

  console.log(`Bitacora restringida a [${tipos.join(', ')}] para ${app}.`);
  console.log('Base de datos lista para las pruebas de integracion.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
