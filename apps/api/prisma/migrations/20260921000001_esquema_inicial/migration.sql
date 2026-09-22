-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "correo" VARCHAR(254) NOT NULL,
    "contrasena_hash" VARCHAR(255) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "sesiones_validas_desde" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,
    "desactivado_el" TIMESTAMPTZ(6),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "apellido_paterno" VARCHAR(120) NOT NULL,
    "apellido_materno" VARCHAR(120),
    "matricula" VARCHAR(30),
    "telefono" VARCHAR(30),
    "programa_id" UUID,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clave" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clave" VARCHAR(60) NOT NULL,
    "recurso" VARCHAR(40) NOT NULL,
    "operacion" VARCHAR(40) NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "exige_motivo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permiso" (
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "otorgado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "asignacion_rol" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "desde_el" TIMESTAMPTZ(6) NOT NULL,
    "hasta_el" TIMESTAMPTZ(6),
    "motivo" VARCHAR(500) NOT NULL,
    "autor_id" UUID NOT NULL,
    "revisar_el" TIMESTAMPTZ(6),
    "revocada_el" TIMESTAMPTZ(6),
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignacion_rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_actividad_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_el" TIMESTAMPTZ(6) NOT NULL,
    "revocada_el" TIMESTAMPTZ(6),
    "motivo_revocacion" VARCHAR(120),
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(400),
    "huella_dispositivo" VARCHAR(64),
    "mfa_verificada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credencial_totp" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "secreto_cifrado" TEXT NOT NULL,
    "nonce" VARCHAR(32) NOT NULL,
    "tag_autenticacion" VARCHAR(32) NOT NULL,
    "activada_el" TIMESTAMPTZ(6),
    "desactivada_el" TIMESTAMPTZ(6),
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credencial_totp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigo_recuperacion_mfa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "codigo_hash" VARCHAR(255) NOT NULL,
    "usado_el" TIMESTAMPTZ(6),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigo_recuperacion_mfa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_recuperacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_el" TIMESTAMPTZ(6) NOT NULL,
    "usado_el" TIMESTAMPTZ(6),
    "invalidado_el" TIMESTAMPTZ(6),
    "invalidado_por_id" UUID,
    "ip_solicitud" VARCHAR(45),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intento_autenticacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "correo" VARCHAR(254) NOT NULL,
    "exitoso" BOOLEAN NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(400),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intento_autenticacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_correo" VARCHAR(254),
    "accion" VARCHAR(60) NOT NULL,
    "tipo_recurso" VARCHAR(60) NOT NULL,
    "recurso_id" VARCHAR(64),
    "resultado" VARCHAR(20) NOT NULL,
    "motivo" VARCHAR(500),
    "antes" JSONB,
    "despues" JSONB,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(400),
    "correlation_id" VARCHAR(64) NOT NULL,

    CONSTRAINT "evento_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "tipo" VARCHAR(60) NOT NULL,
    "severidad" VARCHAR(20) NOT NULL,
    "detalle" VARCHAR(1000) NOT NULL,
    "evento_auditoria_id" UUID,
    "sujeto_id" UUID,
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendida_el" TIMESTAMPTZ(6),
    "atendida_por_id" UUID,
    "clave_idempotencia" VARCHAR(200) NOT NULL,

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "destinatario_id" UUID NOT NULL,
    "tipo" VARCHAR(60) NOT NULL,
    "canal" VARCHAR(20) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "cuerpo" VARCHAR(2000) NOT NULL,
    "estado_entrega" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviada_el" TIMESTAMPTZ(6),
    "leida_el" TIMESTAMPTZ(6),
    "clave_idempotencia" VARCHAR(200) NOT NULL,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "clave" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "clave" VARCHAR(20) NOT NULL,
    "inicia" TIMESTAMPTZ(6) NOT NULL,
    "termina" TIMESTAMPTZ(6) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'abierto',
    "cerrado_el" TIMESTAMPTZ(6),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autorizacion_extraordinaria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "periodo_id" UUID NOT NULL,
    "otorgada_por_id" UUID NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "vigente_hasta" TIMESTAMPTZ(6) NOT NULL,
    "usada_el" TIMESTAMPTZ(6),
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autorizacion_extraordinaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "clave" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "creditos" INTEGER NOT NULL,
    "programa_id" UUID NOT NULL,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aula" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "clave" VARCHAR(20) NOT NULL,
    "edificio" VARCHAR(60) NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "clave" VARCHAR(20) NOT NULL,
    "programa_id" UUID NOT NULL,
    "materia_id" UUID NOT NULL,
    "periodo_id" UUID NOT NULL,
    "aula_id" UUID NOT NULL,
    "cupo" INTEGER NOT NULL,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloque_horario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "dia" VARCHAR(12) NOT NULL,
    "inicio_min" INTEGER NOT NULL,
    "fin_min" INTEGER NOT NULL,
    "aula_id" UUID,
    "periodo_id" UUID,

    CONSTRAINT "bloque_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripcion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "grupo_id" UUID NOT NULL,
    "estudiante_id" UUID NOT NULL,
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baja_el" TIMESTAMPTZ(6),

    CONSTRAINT "inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignacion_docente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "grupo_id" UUID NOT NULL,
    "profesor_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "desde_el" TIMESTAMPTZ(6) NOT NULL,
    "hasta_el" TIMESTAMPTZ(6),
    "autor_id" UUID NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignacion_docente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calificacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "grupo_id" UUID NOT NULL,
    "estudiante_id" UUID NOT NULL,
    "valor" DECIMAL(5,2) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'borrador',
    "version_actual" INTEGER NOT NULL DEFAULT 1,
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_el" TIMESTAMPTZ(6) NOT NULL,
    "publicada_el" TIMESTAMPTZ(6),

    CONSTRAINT "calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_calificacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calificacion_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "valor_anterior" DECIMAL(5,2),
    "valor_nuevo" DECIMAL(5,2) NOT NULL,
    "estado_anterior" VARCHAR(20),
    "estado_nuevo" VARCHAR(20) NOT NULL,
    "autor_id" UUID NOT NULL,
    "motivo" VARCHAR(500),
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "version_calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_documento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "clave" VARCHAR(60) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "mimes_permitidos" VARCHAR(500) NOT NULL,
    "tamano_maximo_bytes" BIGINT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipo_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "titular_id" UUID NOT NULL,
    "subido_por_id" UUID NOT NULL,
    "tipo_documento_id" UUID NOT NULL,
    "nombre_original" VARCHAR(255) NOT NULL,
    "clave_objeto" VARCHAR(200) NOT NULL,
    "bucket" VARCHAR(80) NOT NULL,
    "tipo_mime_real" VARCHAR(120) NOT NULL,
    "tamano_bytes" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "estado_antivirus" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "analizado_el" TIMESTAMPTZ(6),
    "resultado_analisis" VARCHAR(200),
    "subido_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_el" TIMESTAMPTZ(6),

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuota_usuario" (
    "usuario_id" UUID NOT NULL,
    "usado_bytes" BIGINT NOT NULL DEFAULT 0,
    "limite_bytes" BIGINT NOT NULL,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cuota_usuario_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateTable
CREATE TABLE "tipo_solicitud" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "clave" VARCHAR(60) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" VARCHAR(1000) NOT NULL,
    "sla_horas" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipo_solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado_solicitud" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "tipo_solicitud_id" UUID NOT NULL,
    "clave" VARCHAR(60) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "es_inicial" BOOLEAN NOT NULL DEFAULT false,
    "es_final" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "estado_solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_publico" VARCHAR(26) NOT NULL,
    "titular_id" UUID NOT NULL,
    "tipo_solicitud_id" UUID NOT NULL,
    "estado_id" UUID NOT NULL,
    "descripcion" VARCHAR(2000) NOT NULL,
    "responsable_id" UUID,
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_el" TIMESTAMPTZ(6) NOT NULL,
    "vence_el" TIMESTAMPTZ(6),
    "cerrada_el" TIMESTAMPTZ(6),

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_solicitud" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitud_id" UUID NOT NULL,
    "estado_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "comentario" VARCHAR(2000),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_adjunto" (
    "solicitud_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,

    CONSTRAINT "solicitud_adjunto_pkey" PRIMARY KEY ("solicitud_id","documento_id")
);

-- CreateTable
CREATE TABLE "parametro_configuracion" (
    "clave" VARCHAR(80) NOT NULL,
    "valor" VARCHAR(2000) NOT NULL,
    "descripcion" VARCHAR(1000) NOT NULL,
    "decision_id" VARCHAR(10),
    "aprobado_por" VARCHAR(200),
    "aprobado_el" TIMESTAMPTZ(6),
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parametro_configuracion_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_id_publico_key" ON "usuario"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE INDEX "usuario_activo_idx" ON "usuario"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_usuario_id_key" ON "perfil"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_matricula_key" ON "perfil"("matricula");

-- CreateIndex
CREATE INDEX "perfil_programa_id_idx" ON "perfil"("programa_id");

-- CreateIndex
CREATE UNIQUE INDEX "rol_clave_key" ON "rol"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_clave_key" ON "permiso"("clave");

-- CreateIndex
CREATE INDEX "permiso_recurso_idx" ON "permiso"("recurso");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_rol_id_publico_key" ON "asignacion_rol"("id_publico");

-- CreateIndex
CREATE INDEX "asignacion_rol_usuario_id_revocada_el_idx" ON "asignacion_rol"("usuario_id", "revocada_el");

-- CreateIndex
CREATE INDEX "asignacion_rol_rol_id_idx" ON "asignacion_rol"("rol_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_id_publico_key" ON "sesion"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_token_hash_key" ON "sesion"("token_hash");

-- CreateIndex
CREATE INDEX "sesion_usuario_id_revocada_el_idx" ON "sesion"("usuario_id", "revocada_el");

-- CreateIndex
CREATE INDEX "sesion_expira_el_idx" ON "sesion"("expira_el");

-- CreateIndex
CREATE UNIQUE INDEX "credencial_totp_usuario_id_key" ON "credencial_totp"("usuario_id");

-- CreateIndex
CREATE INDEX "codigo_recuperacion_mfa_usuario_id_usado_el_idx" ON "codigo_recuperacion_mfa"("usuario_id", "usado_el");

-- CreateIndex
CREATE UNIQUE INDEX "token_recuperacion_token_hash_key" ON "token_recuperacion"("token_hash");

-- CreateIndex
CREATE INDEX "token_recuperacion_usuario_id_usado_el_idx" ON "token_recuperacion"("usuario_id", "usado_el");

-- CreateIndex
CREATE INDEX "token_recuperacion_expira_el_idx" ON "token_recuperacion"("expira_el");

-- CreateIndex
CREATE INDEX "intento_autenticacion_correo_creado_el_idx" ON "intento_autenticacion"("correo", "creado_el");

-- CreateIndex
CREATE INDEX "intento_autenticacion_ip_creado_el_idx" ON "intento_autenticacion"("ip", "creado_el");

-- CreateIndex
CREATE INDEX "evento_auditoria_actor_id_creado_el_idx" ON "evento_auditoria"("actor_id", "creado_el");

-- CreateIndex
CREATE INDEX "evento_auditoria_tipo_recurso_recurso_id_idx" ON "evento_auditoria"("tipo_recurso", "recurso_id");

-- CreateIndex
CREATE INDEX "evento_auditoria_accion_creado_el_idx" ON "evento_auditoria"("accion", "creado_el");

-- CreateIndex
CREATE INDEX "evento_auditoria_resultado_creado_el_idx" ON "evento_auditoria"("resultado", "creado_el");

-- CreateIndex
CREATE UNIQUE INDEX "alerta_id_publico_key" ON "alerta"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "alerta_clave_idempotencia_key" ON "alerta"("clave_idempotencia");

-- CreateIndex
CREATE INDEX "alerta_tipo_creada_el_idx" ON "alerta"("tipo", "creada_el");

-- CreateIndex
CREATE INDEX "alerta_atendida_el_idx" ON "alerta"("atendida_el");

-- CreateIndex
CREATE UNIQUE INDEX "notificacion_id_publico_key" ON "notificacion"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "notificacion_clave_idempotencia_key" ON "notificacion"("clave_idempotencia");

-- CreateIndex
CREATE INDEX "notificacion_destinatario_id_leida_el_idx" ON "notificacion"("destinatario_id", "leida_el");

-- CreateIndex
CREATE INDEX "notificacion_estado_entrega_idx" ON "notificacion"("estado_entrega");

-- CreateIndex
CREATE UNIQUE INDEX "programa_id_publico_key" ON "programa"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "programa_clave_key" ON "programa"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "periodo_id_publico_key" ON "periodo"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "periodo_clave_key" ON "periodo"("clave");

-- CreateIndex
CREATE INDEX "periodo_estado_idx" ON "periodo"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "autorizacion_extraordinaria_id_publico_key" ON "autorizacion_extraordinaria"("id_publico");

-- CreateIndex
CREATE INDEX "autorizacion_extraordinaria_periodo_id_usada_el_idx" ON "autorizacion_extraordinaria"("periodo_id", "usada_el");

-- CreateIndex
CREATE UNIQUE INDEX "materia_id_publico_key" ON "materia"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "materia_clave_key" ON "materia"("clave");

-- CreateIndex
CREATE INDEX "materia_programa_id_idx" ON "materia"("programa_id");

-- CreateIndex
CREATE UNIQUE INDEX "aula_id_publico_key" ON "aula"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "aula_clave_key" ON "aula"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_id_publico_key" ON "grupo"("id_publico");

-- CreateIndex
CREATE INDEX "grupo_programa_id_periodo_id_idx" ON "grupo"("programa_id", "periodo_id");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_clave_periodo_id_key" ON "grupo"("clave", "periodo_id");

-- CreateIndex
CREATE INDEX "bloque_horario_grupo_id_idx" ON "bloque_horario"("grupo_id");

-- CreateIndex
CREATE INDEX "bloque_horario_dia_inicio_min_fin_min_idx" ON "bloque_horario"("dia", "inicio_min", "fin_min");

-- CreateIndex
CREATE UNIQUE INDEX "inscripcion_id_publico_key" ON "inscripcion"("id_publico");

-- CreateIndex
CREATE INDEX "inscripcion_estudiante_id_baja_el_idx" ON "inscripcion"("estudiante_id", "baja_el");

-- CreateIndex
CREATE UNIQUE INDEX "inscripcion_grupo_id_estudiante_id_key" ON "inscripcion"("grupo_id", "estudiante_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_docente_id_publico_key" ON "asignacion_docente"("id_publico");

-- CreateIndex
CREATE INDEX "asignacion_docente_profesor_id_hasta_el_idx" ON "asignacion_docente"("profesor_id", "hasta_el");

-- CreateIndex
CREATE INDEX "asignacion_docente_grupo_id_hasta_el_idx" ON "asignacion_docente"("grupo_id", "hasta_el");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_docente_grupo_id_version_key" ON "asignacion_docente"("grupo_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "calificacion_id_publico_key" ON "calificacion"("id_publico");

-- CreateIndex
CREATE INDEX "calificacion_estudiante_id_idx" ON "calificacion"("estudiante_id");

-- CreateIndex
CREATE INDEX "calificacion_estado_idx" ON "calificacion"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "calificacion_grupo_id_estudiante_id_key" ON "calificacion"("grupo_id", "estudiante_id");

-- CreateIndex
CREATE INDEX "version_calificacion_autor_id_creada_el_idx" ON "version_calificacion"("autor_id", "creada_el");

-- CreateIndex
CREATE UNIQUE INDEX "version_calificacion_calificacion_id_version_key" ON "version_calificacion"("calificacion_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_documento_id_publico_key" ON "tipo_documento"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_documento_clave_key" ON "tipo_documento"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "documento_id_publico_key" ON "documento"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "documento_clave_objeto_key" ON "documento"("clave_objeto");

-- CreateIndex
CREATE INDEX "documento_titular_id_eliminado_el_idx" ON "documento"("titular_id", "eliminado_el");

-- CreateIndex
CREATE INDEX "documento_estado_antivirus_idx" ON "documento"("estado_antivirus");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_solicitud_id_publico_key" ON "tipo_solicitud"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_solicitud_clave_key" ON "tipo_solicitud"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "estado_solicitud_id_publico_key" ON "estado_solicitud"("id_publico");

-- CreateIndex
CREATE UNIQUE INDEX "estado_solicitud_tipo_solicitud_id_clave_key" ON "estado_solicitud"("tipo_solicitud_id", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_id_publico_key" ON "solicitud"("id_publico");

-- CreateIndex
CREATE INDEX "solicitud_titular_id_cerrada_el_idx" ON "solicitud"("titular_id", "cerrada_el");

-- CreateIndex
CREATE INDEX "solicitud_estado_id_idx" ON "solicitud"("estado_id");

-- CreateIndex
CREATE INDEX "historial_solicitud_solicitud_id_creado_el_idx" ON "historial_solicitud"("solicitud_id", "creado_el");

-- AddForeignKey
ALTER TABLE "perfil" ADD CONSTRAINT "perfil_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil" ADD CONSTRAINT "perfil_programa_id_fkey" FOREIGN KEY ("programa_id") REFERENCES "programa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_rol" ADD CONSTRAINT "asignacion_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_rol" ADD CONSTRAINT "asignacion_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_rol" ADD CONSTRAINT "asignacion_rol_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credencial_totp" ADD CONSTRAINT "credencial_totp_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigo_recuperacion_mfa" ADD CONSTRAINT "codigo_recuperacion_mfa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_recuperacion" ADD CONSTRAINT "token_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_recuperacion" ADD CONSTRAINT "token_recuperacion_invalidado_por_id_fkey" FOREIGN KEY ("invalidado_por_id") REFERENCES "token_recuperacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intento_autenticacion" ADD CONSTRAINT "intento_autenticacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_evento_auditoria_id_fkey" FOREIGN KEY ("evento_auditoria_id") REFERENCES "evento_auditoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorizacion_extraordinaria" ADD CONSTRAINT "autorizacion_extraordinaria_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materia" ADD CONSTRAINT "materia_programa_id_fkey" FOREIGN KEY ("programa_id") REFERENCES "programa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_programa_id_fkey" FOREIGN KEY ("programa_id") REFERENCES "programa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque_horario" ADD CONSTRAINT "bloque_horario_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_profesor_id_fkey" FOREIGN KEY ("profesor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_docente" ADD CONSTRAINT "asignacion_docente_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_calificacion" ADD CONSTRAINT "version_calificacion_calificacion_id_fkey" FOREIGN KEY ("calificacion_id") REFERENCES "calificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_titular_id_fkey" FOREIGN KEY ("titular_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipo_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuota_usuario" ADD CONSTRAINT "cuota_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estado_solicitud" ADD CONSTRAINT "estado_solicitud_tipo_solicitud_id_fkey" FOREIGN KEY ("tipo_solicitud_id") REFERENCES "tipo_solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_titular_id_fkey" FOREIGN KEY ("titular_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_tipo_solicitud_id_fkey" FOREIGN KEY ("tipo_solicitud_id") REFERENCES "tipo_solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "estado_solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_solicitud" ADD CONSTRAINT "historial_solicitud_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_solicitud" ADD CONSTRAINT "historial_solicitud_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "estado_solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_adjunto" ADD CONSTRAINT "solicitud_adjunto_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_adjunto" ADD CONSTRAINT "solicitud_adjunto_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

