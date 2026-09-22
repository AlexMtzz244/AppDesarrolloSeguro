import { z } from 'zod';

/**
 * Validacion de la configuracion al arrancar (RNFS-052).
 *
 * El punto de este archivo no es "leer variables de entorno": es que la
 * aplicacion **se niegue a arrancar** si falta una variable critica, en vez de
 * tomar un valor por defecto silencioso.
 *
 * SC-LAB-003 §3 documenta exactamente el dano que esto evita. RF-010 permitia
 * enlaces de recuperacion de siete dias reutilizables, y "los 7 dias y la
 * reutilizacion no fueron una mala decision de alguien: fueron valores por
 * defecto que nadie decidio, elegidos por quien implemento porque el requisito
 * no daba ninguna guia". Un default silencioso en una variable de seguridad
 * reproduce ese mismo patron a nivel de configuracion.
 *
 * Por eso los secretos NO tienen default. Los umbrales si lo tienen, porque
 * son decisiones institucionales pendientes (D-05) con un valor por defecto
 * seguro declarado y documentado, no un accidente.
 */

const secreto = (nombre: string) =>
  z
    .string({ required_error: `Falta la variable obligatoria ${nombre}` })
    .min(32, `${nombre} debe tener al menos 32 caracteres`);

const booleano = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const entero = (opciones: { min?: number; max?: number } = {}) => {
  let esquema = z.coerce.number().int();
  if (opciones.min !== undefined) esquema = esquema.min(opciones.min);
  if (opciones.max !== undefined) esquema = esquema.max(opciones.max);
  return esquema;
};

export const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PERMITIR_DATOS_SEMILLA: booleano.default('false'),

  // --- Persistencia ---
  DATABASE_URL: z.string().url(),
  DATABASE_URL_MIGRACIONES: z.string().url().optional(),
  REDIS_URL: z.string().url(),

  // --- Almacenamiento privado ---
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(3),
  S3_SECRET_ACCESS_KEY: z.string().min(8),
  S3_BUCKET_DOCUMENTOS: z.string().min(3),
  S3_BUCKET_CUARENTENA: z.string().min(3),
  S3_FORCE_PATH_STYLE: booleano.default('true'),

  // --- Antivirus ---
  CLAMAV_HOST: z.string().min(1),
  CLAMAV_PORT: entero({ min: 1, max: 65535 }).default(3310),

  // --- Correo ---
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: entero({ min: 1, max: 65535 }).default(1025),
  SMTP_FROM: z.string().email(),

  // --- Secretos: sin default, a proposito ---
  SESION_SECRETO_FIRMA: secreto('SESION_SECRETO_FIRMA'),
  MFA_CLAVE_CIFRADO: secreto('MFA_CLAVE_CIFRADO'),

  // --- Sesion (RNFS-012, RNFS-013) ---
  SESION_COOKIE_NOMBRE: z.string().min(1).default('sc_sesion'),
  SESION_INACTIVIDAD_MINUTOS: entero({ min: 1, max: 1440 }).default(30),
  SESION_DURACION_MAXIMA_HORAS: entero({ min: 1, max: 168 }).default(12),
  SESION_COOKIE_SECURE: booleano.default('true'),

  // --- Argon2id (RNFS-010) ---
  ARGON2_MEMORIA_KIB: entero({ min: 8192 }).default(19456),
  ARGON2_ITERACIONES: entero({ min: 2 }).default(2),
  ARGON2_PARALELISMO: entero({ min: 1, max: 16 }).default(1),

  // --- Rate limiting (D-05) ---
  LOGIN_MAX_INTENTOS_CUENTA: entero({ min: 1 }).default(5),
  LOGIN_MAX_INTENTOS_IP: entero({ min: 1 }).default(20),
  LOGIN_VENTANA_MINUTOS: entero({ min: 1 }).default(15),
  LOGIN_RETARDO_BASE_MS: entero({ min: 0 }).default(250),
  LOGIN_UMBRAL_CAPTCHA: entero({ min: 1 }).default(3),
  LOGIN_LATENCIA_MINIMA_MS: entero({ min: 0 }).default(400),
  CAPTCHA_PROVEEDOR: z.enum(['ninguno', 'turnstile', 'recaptcha']).default('ninguno'),
  CAPTCHA_SECRETO: z.string().optional(),

  // --- Recuperacion (RNFS-022) ---
  // El maximo de 30 no es cosmetico: el requisito dice "entre 15 y 30
  // minutos", asi que una configuracion de 7 dias ya no es representable.
  RECUPERACION_VIGENCIA_MINUTOS: entero({ min: 15, max: 30 }).default(20),
  RECUPERACION_MAX_SOLICITUDES_HORA: entero({ min: 1 }).default(3),

  // --- Documentos (D-04) ---
  DOCUMENTO_TAMANO_MAXIMO_MB: entero({ min: 1, max: 100 }).default(10),
  DOCUMENTO_CUOTA_USUARIO_MB: entero({ min: 1 }).default(100),
  DOCUMENTO_TIPOS_PERMITIDOS: z
    .string()
    .default('application/pdf,image/jpeg,image/png')
    .transform((v) => v.split(',').map((t) => t.trim()).filter(Boolean)),

  // --- Alertas (D-05) ---
  ALERTA_UMBRAL_403_POR_MINUTO: entero({ min: 1 }).default(10),
  ALERTA_UMBRAL_DESCARGAS_POR_HORA: entero({ min: 1 }).default(25),
  ALERTA_MINUTOS_CAPTURA_INMEDIATA: entero({ min: 1 }).default(60),
  ALERTA_MINUTOS_REVERSION_SOSPECHOSA: entero({ min: 1 }).default(120),

  // --- Red (RNFS-051) ---
  API_PUERTO: entero({ min: 1, max: 65535 }).default(3001),
  CORS_ORIGENES_PERMITIDOS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
  TRUST_PROXY_SALTOS: entero({ min: 0, max: 10 }).default(1),

  LOG_NIVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  OTEL_HABILITADO: booleano.default('false'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type Entorno = z.infer<typeof esquemaEntorno>;

/**
 * Reglas que no se pueden expresar campo por campo, porque relacionan varios.
 * Son las que impiden arrancar con una configuracion internamente coherente
 * pero insegura para el entorno en que corre.
 */
function validarCoherencia(entorno: Entorno): string[] {
  const errores: string[] = [];

  if (entorno.NODE_ENV === 'production') {
    if (!entorno.SESION_COOKIE_SECURE) {
      errores.push(
        'SESION_COOKIE_SECURE no puede ser false en produccion: la cookie de ' +
          'sesion viajaria por HTTP en claro (RNFS-012).',
      );
    }
    if (entorno.PERMITIR_DATOS_SEMILLA) {
      errores.push(
        'PERMITIR_DATOS_SEMILLA no puede ser true en produccion: las ' +
          'credenciales semilla estan documentadas publicamente (RNFS-058).',
      );
    }
    if (entorno.CAPTCHA_PROVEEDOR === 'ninguno') {
      errores.push(
        'CAPTCHA_PROVEEDOR no puede ser "ninguno" en produccion: el umbral de ' +
          'CAPTCHA es parte del control contra credential stuffing (RNFS-015).',
      );
    }
    if (entorno.CORS_ORIGENES_PERMITIDOS.some((o) => o.startsWith('http://'))) {
      errores.push(
        'CORS_ORIGENES_PERMITIDOS contiene un origen http:// en produccion ' +
          '(RNFS-051).',
      );
    }
  }

  if (entorno.CAPTCHA_PROVEEDOR !== 'ninguno' && !entorno.CAPTCHA_SECRETO) {
    errores.push(
      `CAPTCHA_PROVEEDOR=${entorno.CAPTCHA_PROVEEDOR} exige CAPTCHA_SECRETO.`,
    );
  }

  if (entorno.OTEL_HABILITADO && !entorno.OTEL_EXPORTER_OTLP_ENDPOINT) {
    errores.push('OTEL_HABILITADO=true exige OTEL_EXPORTER_OTLP_ENDPOINT.');
  }

  if (entorno.LOGIN_MAX_INTENTOS_IP < entorno.LOGIN_MAX_INTENTOS_CUENTA) {
    errores.push(
      'LOGIN_MAX_INTENTOS_IP no deberia ser menor que ' +
        'LOGIN_MAX_INTENTOS_CUENTA: un solo usuario legitimo equivocandose ' +
        'agotaria el limite de todo su origen.',
    );
  }

  return errores;
}

/**
 * Valida el entorno o termina el proceso.
 *
 * Termina con `process.exit(1)` y no lanzando una excepcion porque un fallo de
 * configuracion no es recuperable: no tiene sentido que un contenedor quede
 * "arriba" respondiendo peticiones con una clave de cifrado ausente. Fallar
 * ruidosamente es el comportamiento deseado.
 */
export function cargarEntorno(fuente: NodeJS.ProcessEnv = process.env): Entorno {
  const resultado = esquemaEntorno.safeParse(fuente);

  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('\n');

    console.error(
      [
        '',
        '================================================================',
        ' SecureCampus no puede arrancar: configuracion invalida.',
        '================================================================',
        detalle,
        '',
        ' Revisa .env.example y completa tu .env.',
        ' Esto es deliberado (RNFS-052): un valor por defecto silencioso en',
        ' una variable de seguridad es peor que no arrancar.',
        '================================================================',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  const errores = validarCoherencia(resultado.data);
  if (errores.length > 0) {
    console.error(
      [
        '',
        '================================================================',
        ' SecureCampus no puede arrancar: configuracion incoherente.',
        '================================================================',
        ...errores.map((e) => `  - ${e}`),
        '================================================================',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  return resultado.data;
}

export const TOKEN_ENTORNO = Symbol('ENTORNO');
