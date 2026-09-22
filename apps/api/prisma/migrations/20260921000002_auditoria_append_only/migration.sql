-- =============================================================================
-- Auditoria append-only y restricciones de integridad estructural.
--
-- Esta migracion contiene los controles que Prisma no puede expresar en el
-- esquema y que, sin embargo, son los que de verdad sostienen el modelo.
--
-- Corre con el rol PROPIETARIO (DATABASE_URL_MIGRACIONES), no con el rol de la
-- aplicacion. Esa separacion es deliberada: si la aplicacion pudiera migrar,
-- podria deshacer el REVOKE que se define aqui, y el control seria decorativo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Bitacora inmutable (RNFS-031)
-- -----------------------------------------------------------------------------
--
-- SC-LAB-001 escenario 4: "el log append-only y fuera del alcance de escritura
-- de la aplicacion responde al impacto especifico de este escenario: si el
-- atacante alcanza el privilegio administrativo, la bitacora es lo unico que
-- queda, y solo sirve si el no puede editarla."
--
-- Se aplican dos capas con funciones distintas:
--
--   a) El REVOKE es el control REAL. Postgres niega la operacion antes de
--      ejecutar nada, y no hay codigo de aplicacion que pueda sortearlo.
--
--   b) El trigger es defensa en profundidad. Cubre el caso de que alguien
--      ejecute una sentencia con el rol propietario —una consola de soporte,
--      una migracion mal escrita— donde el REVOKE no aplica.
--
-- Ninguna de las dos sobra: la (a) no protege contra el propietario, la (b) se
-- puede borrar si alguien tiene el propietario. Juntas cubren ambos casos.

CREATE OR REPLACE FUNCTION rechazar_mutacion_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'La bitacora de auditoria es de solo insercion: % no esta permitido sobre %',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER evento_auditoria_sin_update
  BEFORE UPDATE ON evento_auditoria
  FOR EACH ROW EXECUTE FUNCTION rechazar_mutacion_auditoria();

CREATE TRIGGER evento_auditoria_sin_delete
  BEFORE DELETE ON evento_auditoria
  FOR EACH ROW EXECUTE FUNCTION rechazar_mutacion_auditoria();

-- TRUNCATE no dispara triggers FOR EACH ROW; necesita el suyo a nivel de
-- sentencia. Sin esto, un solo TRUNCATE borraria la bitacora completa
-- esquivando las dos reglas anteriores.
CREATE TRIGGER evento_auditoria_sin_truncate
  BEFORE TRUNCATE ON evento_auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_mutacion_auditoria();

-- El control principal: quitarle el permiso al rol de aplicacion.
-- El bloque tolera que el rol no exista (entornos de prueba efimeros) pero
-- NO silencia ningun otro error.
DO $$
DECLARE
  rol_app TEXT := current_setting('securecampus.rol_app', true);
BEGIN
  IF rol_app IS NULL OR rol_app = '' THEN
    rol_app := 'securecampus_app';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol_app) THEN
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON evento_auditoria FROM %I', rol_app);
    EXECUTE format('GRANT SELECT, INSERT ON evento_auditoria TO %I', rol_app);
    RAISE NOTICE 'Bitacora restringida a INSERT/SELECT para el rol %', rol_app;
  ELSE
    RAISE WARNING 'El rol % no existe; la bitacora quedo sin restringir. '
                  'Esto es aceptable solo en un entorno de prueba efimero.', rol_app;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Una sola asignacion docente vigente por grupo (RF-031)
-- -----------------------------------------------------------------------------
--
-- La aplicacion tambien lo valida, pero una condicion de carrera entre dos
-- peticiones simultaneas podria dejar dos asignaciones abiertas sobre el mismo
-- grupo. Y "el grupo pertenece a la asignacion vigente del profesor" —el
-- control central del escenario 1 de SC-LAB-001— deja de significar algo si
-- hay dos vigentes a la vez.
CREATE UNIQUE INDEX asignacion_docente_una_vigente_por_grupo
  ON asignacion_docente (grupo_id)
  WHERE hasta_el IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Sin choques de horario (RF-023, conflicto `choque-horario-*`)
-- -----------------------------------------------------------------------------
--
-- Se usan restricciones de exclusion, no validacion en la aplicacion. Dos
-- peticiones concurrentes que reservan la misma aula pasarian ambas una
-- comprobacion previa: solo la base de datos puede decidir esto sin condicion
-- de carrera.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- `bloque_horario.aula_id` y `.periodo_id` existen ya en el esquema como copia
-- del grupo. Este trigger los mantiene sincronizados para que la restriccion
-- de exclusion de mas abajo pueda mirarlos: una exclusion solo alcanza
-- columnas de su propia tabla.
CREATE OR REPLACE FUNCTION sincronizar_contexto_bloque_horario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT g.aula_id, g.periodo_id
    INTO NEW.aula_id, NEW.periodo_id
    FROM grupo g
   WHERE g.id = NEW.grupo_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bloque_horario_sincronizar_contexto
  BEFORE INSERT OR UPDATE ON bloque_horario
  FOR EACH ROW EXECUTE FUNCTION sincronizar_contexto_bloque_horario();

-- Un aula no puede estar ocupada por dos grupos a la vez en el mismo periodo.
ALTER TABLE bloque_horario
  ADD CONSTRAINT bloque_horario_sin_choque_aula
  EXCLUDE USING gist (
    aula_id WITH =,
    periodo_id WITH =,
    dia WITH =,
    int4range(inicio_min, fin_min) WITH &&
  );

-- Un mismo grupo no puede tener dos bloques traslapados.
ALTER TABLE bloque_horario
  ADD CONSTRAINT bloque_horario_sin_traslape_interno
  EXCLUDE USING gist (
    grupo_id WITH =,
    dia WITH =,
    int4range(inicio_min, fin_min) WITH &&
  );

ALTER TABLE bloque_horario
  ADD CONSTRAINT bloque_horario_rango_valido
  CHECK (inicio_min >= 0 AND fin_min <= 1440 AND inicio_min < fin_min);

-- -----------------------------------------------------------------------------
-- 4. Invariantes del dominio
-- -----------------------------------------------------------------------------

-- La vigencia no puede terminar antes de empezar. Aplica a los dos historiales
-- versionados del sistema.
ALTER TABLE asignacion_docente
  ADD CONSTRAINT asignacion_docente_vigencia_coherente
  CHECK (hasta_el IS NULL OR hasta_el > desde_el);

ALTER TABLE asignacion_rol
  ADD CONSTRAINT asignacion_rol_vigencia_coherente
  CHECK (hasta_el IS NULL OR hasta_el > desde_el);

ALTER TABLE periodo
  ADD CONSTRAINT periodo_fechas_coherentes
  CHECK (termina > inicia);

ALTER TABLE periodo
  ADD CONSTRAINT periodo_estado_valido
  CHECK (estado IN ('abierto', 'cerrado'));

-- Un periodo cerrado debe tener fecha de cierre, y uno abierto no debe
-- tenerla. Evita el estado ambiguo "cerrado pero sin constancia de cuando".
ALTER TABLE periodo
  ADD CONSTRAINT periodo_cierre_coherente
  CHECK (
    (estado = 'cerrado' AND cerrado_el IS NOT NULL)
    OR (estado = 'abierto' AND cerrado_el IS NULL)
  );

ALTER TABLE calificacion
  ADD CONSTRAINT calificacion_estado_valido
  CHECK (estado IN ('borrador', 'publicado', 'corregido'));

ALTER TABLE calificacion
  ADD CONSTRAINT calificacion_valor_en_escala
  CHECK (valor >= 0 AND valor <= 100);

-- Una calificacion publicada o corregida debe tener fecha de publicacion; una
-- en borrador no. La maquina de estados vive en el codigo, pero su invariante
-- se sostiene aqui aunque el codigo se equivoque.
ALTER TABLE calificacion
  ADD CONSTRAINT calificacion_publicacion_coherente
  CHECK (
    (estado = 'borrador' AND publicada_el IS NULL)
    OR (estado IN ('publicado', 'corregido') AND publicada_el IS NOT NULL)
  );

-- Toda version posterior a la primera conserva el valor anterior. Es lo que
-- hace reconstruible el historial: sin esto se sabria que hubo un cambio pero
-- no desde que valor (SC-LAB-001 §5.5).
ALTER TABLE version_calificacion
  ADD CONSTRAINT version_calificacion_conserva_anterior
  CHECK (version = 1 OR valor_anterior IS NOT NULL);

-- Una correccion sin motivo no es una correccion auditable (RF-044).
ALTER TABLE version_calificacion
  ADD CONSTRAINT version_calificacion_correccion_con_motivo
  CHECK (estado_nuevo <> 'corregido' OR (motivo IS NOT NULL AND length(trim(motivo)) >= 10));

ALTER TABLE documento
  ADD CONSTRAINT documento_estado_antivirus_valido
  CHECK (estado_antivirus IN ('pendiente', 'en-cuarentena', 'limpio', 'infectado', 'error-analisis'));

ALTER TABLE documento
  ADD CONSTRAINT documento_tamano_positivo
  CHECK (tamano_bytes > 0);

ALTER TABLE cuota_usuario
  ADD CONSTRAINT cuota_usuario_dentro_de_limite
  CHECK (usado_bytes >= 0 AND usado_bytes <= limite_bytes);

ALTER TABLE evento_auditoria
  ADD CONSTRAINT evento_auditoria_resultado_valido
  CHECK (resultado IN ('exito', 'denegado', 'error'));

-- -----------------------------------------------------------------------------
-- 5. Rendimiento de la consulta de autorizacion
-- -----------------------------------------------------------------------------
--
-- Esta consulta corre en CADA peticion autenticada. Si es lenta, la tentacion
-- de cachear permisos en el cliente reaparece, y esa es exactamente la
-- vulnerabilidad (b) del escenario 4 de SC-LAB-001. Un indice adecuado es
-- tambien un control de seguridad.
CREATE INDEX asignacion_rol_vigentes
  ON asignacion_rol (usuario_id, desde_el, hasta_el)
  WHERE revocada_el IS NULL;

CREATE INDEX sesion_activas
  ON sesion (token_hash)
  WHERE revocada_el IS NULL;
