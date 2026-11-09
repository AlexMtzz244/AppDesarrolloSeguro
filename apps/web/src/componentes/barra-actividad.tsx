'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';
import { iniciarActividad, peticionesPendientes, suscribirActividad } from '@/lib/actividad';

/** No se muestra por debajo de este tiempo: una respuesta rapida no parpadea. */
const RETARDO_MS = 150;
/** Una vez visible, se mantiene un minimo para que no se vea un destello. */
const MINIMO_VISIBLE_MS = 350;
/** Una navegacion que nunca confirma la ruta no deja la barra encendida. */
const MAXIMO_NAVEGACION_MS = 8000;
/**
 * Tras cambiar la ruta, la seccion nueva aun tiene que montarse y lanzar sus
 * peticiones. Esta gracia evita que la barra parpadee apagada entre ambas fases.
 */
const GRACIA_TRAS_RUTA_MS = 600;

/**
 * Barra indeterminada en el borde superior, visible mientras haya peticiones a
 * la API en curso. Responde a "¿la aplicacion esta haciendo algo?" desde
 * cualquier pantalla, incluidas las acciones que no tienen su propio spinner.
 */
export function BarraActividad() {
  useActividadDeNavegacion();
  const pendientes = React.useSyncExternalStore(suscribirActividad, peticionesPendientes, () => 0);
  const [visible, setVisible] = React.useState(false);
  const desde = React.useRef(0);

  React.useEffect(() => {
    if (pendientes > 0) {
      const temporizador = setTimeout(() => {
        desde.current = Date.now();
        setVisible(true);
      }, RETARDO_MS);
      return () => clearTimeout(temporizador);
    }
    if (!visible) return;
    const restante = Math.max(0, MINIMO_VISIBLE_MS - (Date.now() - desde.current));
    const temporizador = setTimeout(() => setVisible(false), restante);
    return () => clearTimeout(temporizador);
  }, [pendientes, visible]);

  return (
    <div
      role="progressbar"
      aria-label="Cargando datos"
      aria-hidden={!visible}
      data-visible={visible}
      className="barra-actividad"
    />
  );
}

/**
 * Cuenta como actividad el tiempo entre el clic en un enlace interno y el
 * cambio de ruta. Sin esto la barra solo reaccionaria a las peticiones, que
 * empiezan cuando la seccion ya se monto: la navegacion en si no daria senal.
 */
function useActividadDeNavegacion() {
  const ruta = usePathname();
  const terminar = React.useRef<(() => void) | null>(null);
  const limite = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cerrar = React.useCallback(() => {
    if (limite.current) clearTimeout(limite.current);
    limite.current = null;
    terminar.current?.();
    terminar.current = null;
  }, []);

  React.useEffect(() => {
    function alHacerClic(evento: MouseEvent) {
      if (evento.defaultPrevented || evento.button !== 0) return;
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
      const enlace = (evento.target as Element | null)?.closest?.('a[href]');
      if (!(enlace instanceof HTMLAnchorElement)) return;
      if (enlace.target && enlace.target !== '_self') return;
      if (enlace.origin !== window.location.origin || enlace.hasAttribute('download')) return;
      if (enlace.pathname === window.location.pathname) return;

      cerrar();
      terminar.current = iniciarActividad();
      limite.current = setTimeout(cerrar, MAXIMO_NAVEGACION_MS);
    }
    document.addEventListener('click', alHacerClic, true);
    return () => {
      document.removeEventListener('click', alHacerClic, true);
      cerrar();
    };
  }, [cerrar]);

  // La ruta cambio: la navegacion termino, tras una breve gracia. Si la ruta
  // vuelve a cambiar o el componente se desmonta, se cierra de inmediato.
  React.useEffect(() => {
    const espera = setTimeout(cerrar, GRACIA_TRAS_RUTA_MS);
    return () => {
      clearTimeout(espera);
      cerrar();
    };
  }, [ruta, cerrar]);
}
