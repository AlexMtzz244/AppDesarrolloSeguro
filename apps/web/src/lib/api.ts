import type { ErrorApi } from '@securecampus/contracts';

/**
 * Cliente de la API.
 *
 * Dos decisiones importan aqui, y ninguna es de comodidad:
 *
 * 1. **`credentials: 'include'` y nada mas.** La sesion viaja en una cookie
 *    `HttpOnly` que este codigo no puede leer ni escribir. No hay token en
 *    `localStorage`, no hay cabecera `Authorization` que construir. Si el
 *    frontend pudiera leer la sesion, un XSS la robaria (RNFS-012).
 *
 * 2. **El cliente no decide nada.** Este modulo no comprueba permisos ni
 *    filtra respuestas: pide y muestra. Lo que puede o no puede hacer el
 *    usuario lo decide el servidor en cada peticion (RNFS-001).
 */

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export class ErrorDeApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly correlationId: string,
    readonly campos?: Record<string, string[]>,
  ) {
    super(mensaje);
    this.name = 'ErrorDeApi';
  }

  /** Distingue "no has iniciado sesion" de "no tienes permiso". */
  get esSesionExpirada(): boolean {
    return this.estado === 401;
  }

  get esDenegado(): boolean {
    return this.estado === 403;
  }
}

interface OpcionesPeticion {
  readonly metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly cuerpo?: unknown;
  readonly señal?: AbortSignal;
}

export async function llamar<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const init: RequestInit = {
    method: opciones.metodo ?? 'GET',
    // La sesion viaja en la cookie HttpOnly; sin esto el navegador no la envia
    // entre origenes y toda peticion seria anonima.
    credentials: 'include',
  };

  if (opciones.cuerpo !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(opciones.cuerpo);
  }
  if (opciones.señal) init.signal = opciones.señal;

  const respuesta = await fetch(`${BASE}/api${ruta}`, init);

  if (respuesta.status === 204) return undefined as T;

  const texto = await respuesta.text();
  const cuerpo: unknown = texto ? JSON.parse(texto) : null;

  if (!respuesta.ok) {
    const error = cuerpo as Partial<ErrorApi> | null;
    throw new ErrorDeApi(
      respuesta.status,
      error?.codigo ?? 'ERROR',
      // Se muestra el mensaje del servidor tal cual. Es generico por diseno
      // (RNFS-050) y no conviene "mejorarlo" aqui: una version mas util del
      // mensaje en el cliente revelaria lo que el servidor callo a proposito.
      error?.mensaje ?? 'Ocurrio un error al procesar la solicitud.',
      error?.correlationId ?? 'sin-correlacion',
      error?.campos,
    );
  }

  return cuerpo as T;
}

export const api = {
  get: <T>(ruta: string, señal?: AbortSignal) =>
    llamar<T>(ruta, señal ? { señal } : {}),
  post: <T>(ruta: string, cuerpo?: unknown) => llamar<T>(ruta, { metodo: 'POST', cuerpo }),
  patch: <T>(ruta: string, cuerpo?: unknown) => llamar<T>(ruta, { metodo: 'PATCH', cuerpo }),
  delete: <T>(ruta: string) => llamar<T>(ruta, { metodo: 'DELETE' }),
};
