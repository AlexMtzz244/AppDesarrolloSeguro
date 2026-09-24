'use client';

import {
  animate,
  motion,
  MotionConfig,
  useInView,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from 'motion/react';
import * as React from 'react';

/**
 * Movimiento con las curvas y duraciones de Fluent 2.
 *
 * Todo pasa por `MotionConfig reducedMotion="user"`: si el sistema pide menos
 * movimiento, las transformaciones desaparecen y solo quedan los cambios de
 * opacidad, que no marean. Es el mismo criterio que la regla de CSS de
 * `globals.css`, aplicado a lo que anima JavaScript.
 */

export const CURVA_DECELERAR = [0.1, 0.9, 0.2, 1] as const;
export const CURVA_ACELERAR = [0.9, 0.1, 1, 0.2] as const;
export const CURVA_ESTANDAR = [0.8, 0, 0.2, 1] as const;

export const DURACION = { rapida: 0.167, normal: 0.25, lenta: 0.367, entrada: 0.5 } as const;

export function ProveedorMovimiento({ children }: { readonly children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Entrada de pagina/elemento: sube un poco y aparece, frenando al final. */
export const varianteEntrada: Variants = {
  oculto: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURACION.entrada, ease: CURVA_DECELERAR },
  },
};

export const varianteEscalonada: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

type PropsAparecer = HTMLMotionProps<'div'> & { readonly retraso?: number };

/** Envuelve un bloque para que entre con el movimiento de Fluent. */
export function Aparecer({ retraso = 0, children, ...props }: PropsAparecer) {
  return (
    <motion.div
      initial="oculto"
      animate="visible"
      variants={{
        oculto: varianteEntrada['oculto']!,
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: DURACION.entrada, ease: CURVA_DECELERAR, delay: retraso },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Contenedor cuyos hijos `ElementoEscalonado` entran uno tras otro. */
export function Escalonado({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div initial="oculto" animate="visible" variants={varianteEscalonada} {...props}>
      {children}
    </motion.div>
  );
}

export function ElementoEscalonado({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={varianteEntrada} {...props}>
      {children}
    </motion.div>
  );
}

/**
 * Numero que cuenta hasta su valor al entrar en pantalla.
 *
 * El valor final se escribe desde el principio en `aria-label`, para que un
 * lector de pantalla no anuncie la cuenta intermedia.
 */
export function ContadorAnimado({
  valor,
  className,
}: {
  readonly valor: number;
  readonly className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true });
  const reducido = useReducedMotion();

  React.useEffect(() => {
    const nodo = ref.current;
    if (!nodo || !visible) return;
    if (reducido) {
      nodo.textContent = String(valor);
      return;
    }
    const control = animate(0, valor, {
      duration: 1.1,
      ease: CURVA_DECELERAR,
      onUpdate: (v) => {
        nodo.textContent = String(Math.round(v));
      },
    });
    return () => control.stop();
  }, [valor, visible, reducido]);

  return (
    <span ref={ref} className={className} aria-label={String(valor)}>
      {reducido ? valor : 0}
    </span>
  );
}

/**
 * Registra la posicion del puntero en `--x`/`--y` para el efecto `.revelar`.
 * Se escribe directo en el estilo del nodo: re-renderizar React en cada
 * movimiento del raton seria desperdicio.
 */
export function manejarRevelar(evento: React.PointerEvent<HTMLElement>) {
  const nodo = evento.currentTarget;
  const caja = nodo.getBoundingClientRect();
  nodo.style.setProperty('--x', `${evento.clientX - caja.left}px`);
  nodo.style.setProperty('--y', `${evento.clientY - caja.top}px`);
}
