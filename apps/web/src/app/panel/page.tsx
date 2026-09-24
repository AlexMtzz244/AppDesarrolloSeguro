'use client';

import {
  ArrowRight16Regular,
  Key20Regular,
  PersonKey20Regular,
  ShieldCheckmark20Regular,
  ShieldKeyhole20Regular,
  Sparkle20Regular,
  type FluentIcon,
} from '@fluentui/react-icons';
import { motion } from 'motion/react';
import Link from 'next/link';
import * as React from 'react';
import { ContadorAnimado, CURVA_DECELERAR, manejarRevelar } from '@/componentes/movimiento';
import { useSesion } from '@/componentes/sesion';
import { Insignia, Panel } from '@/componentes/ui';
import { cn } from '@/lib/utilidades';

/**
 * Inicio del area autenticada.
 *
 * Muestra la identidad efectiva del actor tal como la calculo el SERVIDOR,
 * incluidos sus permisos. Exponerlos no es una fuga: son los permisos de quien
 * esta mirando, y verlos ayuda a entender por que una opcion aparece o no.
 * Lo que no hace esta pantalla es usarlos para decidir nada.
 */
export default function PaginaInicioPanel() {
  const { actor } = useSesion();
  const saludo = useSaludo();
  if (!actor) return null;

  const estadoMfa = actor.mfaActivo ? 'activo' : actor.mfaObligatorio ? 'pendiente' : 'opcional';

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-borde/60 bg-tarjeta shadow-elevacion-8">
        <div
          className="absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,hsl(var(--bloom-2)/0.28),transparent_60%),radial-gradient(70%_100%_at_0%_100%,hsl(var(--bloom-1)/0.25),transparent_60%)]"
          aria-hidden
        />
        <HeroPetalos />
        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: CURVA_DECELERAR }}
            className="flex items-center gap-1.5 text-sm font-medium text-primario"
          >
            <Sparkle20Regular aria-hidden />
            {saludo}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: CURVA_DECELERAR, delay: 0.05 }}
            className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Hola, {actor.nombre}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-1 text-sm text-tenue"
          >
            {actor.correo}
          </motion.p>
        </div>
      </section>

      {/* Tiles de estado */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile indice={0} icono={PersonKey20Regular} titulo="Roles">
          <div className="flex flex-wrap gap-1.5">
            {actor.roles.map((rol) => (
              <Insignia key={rol}>{rol}</Insignia>
            ))}
          </div>
        </Tile>

        <Tile indice={1} icono={ShieldKeyhole20Regular} titulo="Segundo factor">
          <div className="flex items-center gap-3">
            <AnilloMfa estado={estadoMfa} />
            {estadoMfa === 'activo' ? (
              <Insignia tono="exito">Activo</Insignia>
            ) : estadoMfa === 'pendiente' ? (
              <Insignia tono="peligro">Obligatorio, sin configurar</Insignia>
            ) : (
              <Insignia tono="aviso">Opcional, sin configurar</Insignia>
            )}
          </div>
        </Tile>

        <Tile indice={2} icono={ShieldCheckmark20Regular} titulo="Permisos vigentes">
          <p className="text-4xl font-semibold tabular-nums tracking-tight">
            <ContadorAnimado valor={actor.permisos.length} />
          </p>
          <p className="text-xs text-tenue">Calculados por el servidor en cada peticion.</p>
        </Tile>
      </div>

      {/* Accesos rapidos */}
      <div className="grid gap-4 md:grid-cols-2">
        <AccesoRapido
          href="/panel/perfil"
          icono={ShieldKeyhole20Regular}
          titulo="Revisar sesiones activas"
          detalle="Si ves una que no reconoces, revocala y cambia tu contrasena."
        />
        <AccesoRapido
          href="/panel/perfil"
          icono={Key20Regular}
          titulo="Cambiar contrasena"
          detalle="Cambiarla cierra todas tus sesiones, incluida esta."
        />
      </div>

      <Panel
        titulo="Tus permisos"
        icono={ShieldCheckmark20Regular}
        descripcion="Lo que la interfaz muestra se deriva de esta lista; lo que puedes hacer lo decide el servidor."
      >
        <ul className="flex flex-wrap gap-1.5">
          {[...actor.permisos].sort().map((permiso, i) => (
            <motion.li
              key={permiso}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: CURVA_DECELERAR, delay: 0.2 + Math.min(i, 30) * 0.015 }}
            >
              <code className="block rounded-md border border-borde/70 bg-panel px-2 py-1 font-mono text-xs transition-colors hover:border-primario/50 hover:bg-primario-suave">
                {permiso}
              </code>
            </motion.li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function useSaludo() {
  // Se calcula tras montar: la hora del servidor no es la del usuario, y
  // calcularla durante el render causaria un desajuste de hidratacion.
  const [saludo, setSaludo] = React.useState('Hola de nuevo');
  React.useEffect(() => {
    const hora = new Date().getHours();
    setSaludo(hora < 12 ? 'Buenos dias' : hora < 19 ? 'Buenas tardes' : 'Buenas noches');
  }, []);
  return saludo;
}

function Tile({
  indice,
  icono: Icono,
  titulo,
  children,
}: {
  readonly indice: number;
  readonly icono: FluentIcon;
  readonly titulo: string;
  readonly children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: CURVA_DECELERAR, delay: 0.1 + indice * 0.07 }}
      whileHover={{ y: -3 }}
      onPointerMove={manejarRevelar}
      className="revelar revelar-borde rounded-lg border border-borde/70 bg-tarjeta p-5 shadow-elevacion-4 transition-shadow duration-normal hover:shadow-elevacion-16"
    >
      <div className="relative z-10 space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-tenue">
          <Icono className="text-primario" aria-hidden />
          {titulo}
        </h2>
        {children}
      </div>
    </motion.section>
  );
}

/** Anillo de progreso de Fluent: completo cuando el segundo factor esta activo. */
function AnilloMfa({ estado }: { readonly estado: 'activo' | 'pendiente' | 'opcional' }) {
  const progreso = estado === 'activo' ? 1 : estado === 'opcional' ? 0.5 : 0.15;
  const color = estado === 'activo' ? 'text-exito' : estado === 'opcional' ? 'text-aviso' : 'text-peligro';
  const circunferencia = 2 * Math.PI * 16;
  return (
    <svg viewBox="0 0 40 40" className={cn('h-11 w-11 -rotate-90', color)} aria-hidden>
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
      <motion.circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circunferencia}
        initial={{ strokeDashoffset: circunferencia }}
        animate={{ strokeDashoffset: circunferencia * (1 - progreso) }}
        transition={{ duration: 1.1, ease: CURVA_DECELERAR, delay: 0.3 }}
      />
    </svg>
  );
}

function AccesoRapido({
  href,
  icono: Icono,
  titulo,
  detalle,
}: {
  readonly href: string;
  readonly icono: FluentIcon;
  readonly titulo: string;
  readonly detalle: string;
}) {
  return (
    <Link
      href={href}
      onPointerMove={manejarRevelar}
      className="revelar revelar-borde group flex animate-entrada items-center gap-4 rounded-lg border border-borde/70 bg-tarjeta p-4 shadow-elevacion-2 transition-[box-shadow,transform] duration-normal ease-fluent-decelerate hover:-translate-y-0.5 hover:shadow-elevacion-8"
    >
      <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primario-suave text-primario transition-transform duration-normal group-hover:scale-110">
        <Icono aria-hidden />
      </span>
      <span className="relative z-10 min-w-0 flex-1">
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-tenue">{detalle}</span>
      </span>
      <ArrowRight16Regular
        className="relative z-10 shrink-0 text-tenue transition-transform duration-normal ease-fluent-decelerate group-hover:translate-x-1 group-hover:text-primario"
        aria-hidden
      />
    </Link>
  );
}

/** Petalos Bloom decorativos en la esquina del hero. */
function HeroPetalos() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 opacity-60 blur-md dark:opacity-70 sm:h-96 sm:w-96"
      aria-hidden
    >
      <g className="origin-center animate-deriva" style={{ transformBox: 'fill-box' }}>
        {[0, 72, 144, 216, 288].map((angulo, i) => (
          <path
            key={angulo}
            d="M200 200 C 165 150, 180 85, 200 55 C 220 85, 235 150, 200 200 Z"
            fill={`hsl(var(--${i % 2 ? 'bloom-2' : 'bloom-1'}) / 0.55)`}
            transform={`rotate(${angulo} 200 200)`}
          />
        ))}
      </g>
    </svg>
  );
}
