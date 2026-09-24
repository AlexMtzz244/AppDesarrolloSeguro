'use client';

import { motion } from 'motion/react';
import { CURVA_DECELERAR } from '@/componentes/movimiento';

/**
 * Transicion de entrada entre secciones ("page entrance" de Fluent). Next
 * vuelve a montar la plantilla en cada navegacion, asi que cada seccion entra
 * con el mismo movimiento corto, sin retrasar la interaccion.
 */
export default function PlantillaPanel({ children }: { readonly children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: CURVA_DECELERAR }}
      className="space-y-6"
    >
      {children}
    </motion.div>
  );
}
