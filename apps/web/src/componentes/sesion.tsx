'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { ActorPublico, Permiso } from '@securecampus/contracts';
import { api, ErrorDeApi } from '@/lib/api';

/**
 * Contexto de sesion del cliente.
 *
 * # Advertencia que conviene leer antes de usar esto
 *
 * Este objeto sirve **solo para decidir que se dibuja**. No es un control de
 * acceso y no debe tratarse como tal.
 *
 * SC-LAB-001 escenario 4 describe la vulnerabilidad exacta que se evita al
 * recordarlo: "El control de acceso se aplica solo en la interfaz: se ocultan
 * los elementos del menu, pero los endpoints no verifican nada."
 *
 * Aqui pasa lo contrario. El menu se oculta por comodidad, y cada endpoint
 * vuelve a verificar contra la sesion del servidor. Si alguien alterara este
 * objeto desde la consola del navegador, veria botones nuevos que al pulsarse
 * devuelven 403 — que es precisamente el comportamiento correcto.
 */

interface EstadoSesion {
  readonly actor: ActorPublico | null;
  readonly cargando: boolean;
  readonly error: string | null;
  refrescar(): Promise<void>;
  cerrarSesion(): Promise<void>;
}

const ContextoSesion = React.createContext<EstadoSesion | null>(null);

export function ProveedorSesion({ children }: { readonly children: React.ReactNode }) {
  const router = useRouter();
  const [actor, setActor] = React.useState<ActorPublico | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refrescar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setActor(await api.get<ActorPublico>('/auth/yo'));
    } catch (e) {
      if (e instanceof ErrorDeApi && e.esSesionExpirada) {
        setActor(null);
      } else {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la sesion.');
      }
    } finally {
      setCargando(false);
    }
  }, []);

  const cerrarSesion = React.useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Se limpia el estado local pase lo que pase. La revocacion real la hizo
      // el servidor; esto solo evita que la interfaz siga mostrando datos de
      // una sesion que ya no vale.
      setActor(null);
      router.push('/ingresar');
    }
  }, [router]);

  React.useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const valor = React.useMemo<EstadoSesion>(
    () => ({ actor, cargando, error, refrescar, cerrarSesion }),
    [actor, cargando, error, refrescar, cerrarSesion],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): EstadoSesion {
  const contexto = React.useContext(ContextoSesion);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de <ProveedorSesion>.');
  }
  return contexto;
}

/**
 * Comprueba un permiso **para decidir que mostrar**.
 *
 * El nombre es deliberadamente largo. `puede()` a secas invitaria a pensar que
 * esto autoriza algo; no lo hace.
 */
export function useMuestraSi(permiso: Permiso): boolean {
  const { actor } = useSesion();
  return actor?.permisos.includes(permiso) ?? false;
}
