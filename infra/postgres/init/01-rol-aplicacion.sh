#!/bin/bash
# =============================================================================
# Crea el rol de aplicacion con privilegio minimo.
#
# Se ejecuta UNA SOLA VEZ, en el primer arranque del contenedor de Postgres.
#
# La separacion de roles es el control real de RNFS-031, no el trigger que
# viene despues en la migracion: si la aplicacion se conectara como propietaria
# de la base, podria ejecutar UPDATE sobre la bitacora, o simplemente borrar el
# trigger que se lo impide. Quitar el permiso es lo unico que cierra el hueco.
#
# SC-LAB-001 escenario 4: "el log append-only y fuera del alcance de escritura
# de la aplicacion responde al impacto especifico de este escenario: si el
# atacante alcanza el privilegio administrativo, la bitacora es lo unico que
# queda, y solo sirve si el no puede editarla".
# =============================================================================
set -euo pipefail

if [[ -z "${POSTGRES_APP_USER:-}" || -z "${POSTGRES_APP_PASSWORD:-}" ]]; then
  echo "ERROR: POSTGRES_APP_USER y POSTGRES_APP_PASSWORD son obligatorias." >&2
  echo "       Copia .env.example a .env y completalas antes de levantar." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set app_user="$POSTGRES_APP_USER" \
  --set app_password="$POSTGRES_APP_PASSWORD" \
  --set db_name="$POSTGRES_DB" \
  --set owner_user="$POSTGRES_USER" <<'EOSQL'

-- Rol de aplicacion: puede conectarse y operar, pero no es propietario de nada
-- y no puede crear ni alterar estructura.
CREATE ROLE :"app_user" WITH LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";

-- Las tablas todavia no existen: las crea Prisma con el rol propietario.
-- Estos privilegios por omision se aplican a las tablas que ese rol cree
-- despues. La migracion revoca luego lo que sobra sobre evento_auditoria.
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_user" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";

ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_user" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";

EOSQL

echo "Rol de aplicacion '${POSTGRES_APP_USER}' creado con privilegio minimo."
