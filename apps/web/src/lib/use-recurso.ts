'use client';

import * as React from 'react';
import { api, ErrorDeApi } from './api';

export interface EstadoRecurso<T> {
  readonly datos: T | null;
  readonly cargando: boolean;
  readonly error: ErrorDeApi | null;
  recargar(): void;
}

/**
 * Carga un recurso de la API con sus cuatro estados (RNFS-061).
 *
 * Se centraliza aqui para que ninguna pantalla se quede sin estado de error o
 * sin reintento. El requisito de interfaz del prompt maestro pide "estados de
 * carga, exito, error y reintento para todas las operaciones remotas", y la
 * unica forma fiable de cumplirlo en todas es no dejarlo a criterio de cada
 * pagina.
 *
 * Un 403 se trata como un error normal y se muestra tal cual. No se
 * reinterpreta como "no hay datos": si el servidor denego, la pantalla lo
 * dice, y eso hace visible en desarrollo cualquier desajuste entre lo que el
 * menu muestra y lo que la API autoriza.
 */
export function useRecurso<T>(ruta: string | null, dependencias: unknown[] = []): EstadoRecurso<T> {
  const [datos, setDatos] = React.useState<T | null>(null);
  const [cargando, setCargando] = React.useState(Boolean(ruta));
  const [error, setError] = React.useState<ErrorDeApi | null>(null);
  const [intento, setIntento] = React.useState(0);

  React.useEffect(() => {
    if (!ruta) {
      setCargando(false);
      return;
    }

    const controlador = new AbortController();
    let vigente = true;

    setCargando(true);
    setError(null);

    api
      .get<T>(ruta, controlador.signal)
      .then((resultado) => {
        if (vigente) setDatos(resultado);
      })
      .catch((e: unknown) => {
        if (!vigente || controlador.signal.aborted) return;
        setError(e instanceof ErrorDeApi ? e : new ErrorDeApi(0, 'RED', 'Sin conexion con el servidor.', '—'));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
      controlador.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, intento, ...dependencias]);

  const recargar = React.useCallback(() => setIntento((n) => n + 1), []);

  return { datos, cargando, error, recargar };
}
