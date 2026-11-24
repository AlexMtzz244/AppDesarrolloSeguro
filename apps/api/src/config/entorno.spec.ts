import { afterEach, describe, expect, it, vi } from 'vitest';
import { cargarEntorno } from './entorno.js';

/**
 * HTTP local frente a HTTPS (SC-LAB-008, pasos 6 y 8).
 *
 * El laboratorio usa `SC_COOKIE_SECURE=0` solo porque corre en
 * http://127.0.0.1 y advierte: "en produccion NO es apropiado". Aqui esa
 * advertencia es una regla que impide arrancar, no una nota para leer.
 */

const BASE: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://localhost:5432/securecampus',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'clave-s3',
  S3_SECRET_ACCESS_KEY: 'secreto-s3-largo',
  S3_BUCKET_DOCUMENTOS: 'documentos',
  S3_BUCKET_CUARENTENA: 'cuarentena',
  CLAMAV_HOST: 'localhost',
  SMTP_HOST: 'localhost',
  SMTP_FROM: 'no-responder@securecampus.test',
  SESION_SECRETO_FIRMA: 'a'.repeat(40),
  MFA_CLAVE_CIFRADO: 'b'.repeat(40),
};

const PRODUCCION_VALIDA: NodeJS.ProcessEnv = {
  ...BASE,
  NODE_ENV: 'production',
  SESION_COOKIE_SECURE: 'true',
  CORS_ORIGENES_PERMITIDOS: 'https://campus.example.mx',
  CAPTCHA_PROVEEDOR: 'turnstile',
  CAPTCHA_SECRETO: 'secreto-captcha',
};

/** `cargarEntorno` termina el proceso ante un error: se intercepta para leerlo. */
function arranca(env: NodeJS.ProcessEnv): { arranca: boolean; mensaje: string } {
  const salida = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit');
  }) as never);
  const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    cargarEntorno(env);
    return { arranca: true, mensaje: '' };
  } catch {
    return { arranca: false, mensaje: consola.mock.calls.flat().join('\n') };
  } finally {
    salida.mockRestore();
    consola.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe('configuracion: cookie Secure y HTTPS fuera de localhost', () => {
  it('en desarrollo la cookie Secure es true por omision, y se puede apagar para HTTP local', () => {
    expect(cargarEntorno({ ...BASE }).SESION_COOKIE_SECURE).toBe(true);
    expect(cargarEntorno({ ...BASE, SESION_COOKIE_SECURE: 'false' }).SESION_COOKIE_SECURE).toBe(false);
  });

  it('una configuracion de produccion con HTTPS y cookie Secure arranca', () => {
    expect(arranca(PRODUCCION_VALIDA).arranca).toBe(true);
  });

  it('produccion NO arranca con SESION_COOKIE_SECURE=false', () => {
    const r = arranca({ ...PRODUCCION_VALIDA, SESION_COOKIE_SECURE: 'false' });
    expect(r.arranca).toBe(false);
    expect(r.mensaje).toContain('SESION_COOKIE_SECURE');
  });

  it('produccion NO arranca con un origen http:// en CORS', () => {
    const r = arranca({ ...PRODUCCION_VALIDA, CORS_ORIGENES_PERMITIDOS: 'http://campus.example.mx' });
    expect(r.arranca).toBe(false);
    expect(r.mensaje).toContain('CORS_ORIGENES_PERMITIDOS');
  });
});
