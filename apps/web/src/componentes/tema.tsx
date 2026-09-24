'use client';

import { WeatherMoon20Regular, WeatherSunny20Regular } from '@fluentui/react-icons';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { cn } from '@/lib/utilidades';

/**
 * Tema claro/oscuro.
 *
 * Por defecto sigue al sistema. Si la persona elige uno, se recuerda en
 * `localStorage` — es una preferencia de este navegador, nada que el servidor
 * necesite saber. Todo acceso al almacenamiento va en try/catch: en modo
 * privado o con el almacenamiento bloqueado puede lanzar, y eso no debe
 * romper la pagina.
 */

const CLAVE = 'sc-tema';

/**
 * Se ejecuta antes del primer pintado para que no haya un destello del tema
 * equivocado. Es texto fijo, sin datos de usuario interpolados.
 */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('${CLAVE}');var o=t?t==='oscuro':matchMedia('(prefers-color-scheme: dark)').matches;if(o)document.documentElement.classList.add('dark');}catch(e){}})();`;

function leerOscuro(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export function useTema() {
  const [oscuro, setOscuro] = React.useState(false);

  React.useEffect(() => {
    setOscuro(leerOscuro());
  }, []);

  const alternar = React.useCallback(() => {
    const siguiente = !leerOscuro();
    document.documentElement.classList.toggle('dark', siguiente);
    setOscuro(siguiente);
    try {
      localStorage.setItem(CLAVE, siguiente ? 'oscuro' : 'claro');
    } catch {
      // Sin almacenamiento, el tema dura lo que dure la pagina.
    }
  }, []);

  return { oscuro, alternar };
}

export function AlternadorTema({ className }: { readonly className?: string }) {
  const { oscuro, alternar } = useTema();
  const etiqueta = oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        'relative grid h-8 w-8 place-items-center overflow-hidden rounded-md text-texto',
        'transition-colors duration-rapido hover:bg-texto/[0.06] active:bg-texto/[0.1]',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={oscuro ? 'luna' : 'sol'}
          initial={{ y: 14, opacity: 0, rotate: -40 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 40 }}
          transition={{ duration: 0.25, ease: [0.1, 0.9, 0.2, 1] }}
          className="grid place-items-center"
          aria-hidden
        >
          {oscuro ? <WeatherMoon20Regular /> : <WeatherSunny20Regular />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
