'use client';

import {
  History20Regular,
  LockClosed20Regular,
  ShieldCheckmark20Regular,
  type FluentIcon,
} from '@fluentui/react-icons';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { FondoBloom, Logotipo } from '@/componentes/marca';
import { CURVA_DECELERAR } from '@/componentes/movimiento';
import { AlternadorTema } from '@/componentes/tema';

const GARANTIAS: readonly { icono: FluentIcon; titulo: string; detalle: string }[] = [
  {
    icono: LockClosed20Regular,
    titulo: 'Sesion protegida',
    detalle: 'La cookie de sesion no es legible desde el navegador.',
  },
  {
    icono: ShieldCheckmark20Regular,
    titulo: 'Segundo factor',
    detalle: 'Los roles con acceso sensible exigen codigo de verificacion.',
  },
  {
    icono: History20Regular,
    titulo: 'Todo queda registrado',
    detalle: 'Cada accion relevante se audita en un registro de solo escritura.',
  },
];

/**
 * Marco de las pantallas sin sesion (ingresar y recuperar): fondo Bloom,
 * columna de marca en escritorio y una tarjeta acrilica con el formulario.
 *
 * `clave` identifica el paso actual; al cambiar, el titulo y el contenido se
 * deslizan como una pagina nueva, en lugar de cambiar de golpe.
 */
export function MarcoAcceso({
  titulo,
  descripcion,
  clave,
  children,
  pie,
}: {
  readonly titulo: string;
  readonly descripcion: string;
  readonly clave?: string;
  readonly children: React.ReactNode;
  readonly pie?: React.ReactNode;
}) {
  return (
    <>
      <FondoBloom />
      <div className="fixed right-3 top-3 z-20">
        <AlternadorTema className="acrilico shadow-elevacion-4" />
      </div>

      <main
        id="contenido"
        className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-4 py-12 lg:grid-cols-[1.1fr_1fr] lg:px-8"
      >
        {/* Columna de marca: solo en pantallas anchas. */}
        <motion.section
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: CURVA_DECELERAR }}
          className="hidden lg:block"
          aria-hidden
        >
          <div className="flex items-center gap-3">
            <Logotipo className="h-12 w-12 drop-shadow-lg" />
            <span className="text-xl font-semibold">SecureCampus</span>
          </div>
          <p className="mt-8 max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Tu vida academica,{' '}
            <span className="bg-gradient-to-r from-primario via-[hsl(var(--bloom-2))] to-[hsl(var(--bloom-3))] bg-clip-text text-transparent">
              con la puerta bien cerrada.
            </span>
          </p>
          <ul className="mt-10 space-y-5">
            {GARANTIAS.map(({ icono: Icono, titulo: t, detalle }, i) => (
              <motion.li
                key={t}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: CURVA_DECELERAR, delay: 0.25 + i * 0.1 }}
                className="flex items-start gap-4"
              >
                <span className="acrilico grid h-10 w-10 shrink-0 place-items-center rounded-lg text-primario shadow-elevacion-4">
                  <Icono />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{t}</span>
                  <span className="block text-sm text-tenue">{detalle}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        {/* Tarjeta acrilica */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: CURVA_DECELERAR }}
          className="mx-auto w-full max-w-md"
        >
          <div className="acrilico grano overflow-hidden rounded-xl border border-white/40 p-7 shadow-elevacion-28 dark:border-white/10 sm:p-9">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <Logotipo className="h-8 w-8" />
              <span className="font-semibold">SecureCampus</span>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={clave ?? 'unico'}
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32 }}
                transition={{ duration: 0.3, ease: CURVA_DECELERAR }}
                className="space-y-6"
              >
                <header className="space-y-1.5">
                  <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
                  <p className="text-sm text-tenue">{descripcion}</p>
                </header>
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
          {pie ? <div className="mt-5 text-center text-sm">{pie}</div> : null}
        </motion.div>
      </main>
    </>
  );
}
