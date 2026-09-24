'use client';

import * as React from 'react';
import { cn } from '@/lib/utilidades';

/** Logotipo: un escudo con birrete, en el degradado de marca. */
export function Logotipo({ className }: { readonly className?: string }) {
  // useId trae caracteres que no son validos dentro de url(#...).
  const id = 'logo' + React.useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(var(--bloom-3))" />
          <stop offset="0.5" stopColor="hsl(var(--primario))" />
          <stop offset="1" stopColor="hsl(var(--bloom-2))" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5 5 6.6v8.2c0 6.9 4.6 12.4 11 14.7 6.4-2.3 11-7.8 11-14.7V6.6L16 2.5Z"
        fill={`url(#${id}-g)`}
      />
      <path
        d="M16 10.2 9.2 13.4 16 16.6l6.8-3.2L16 10.2Zm-4.3 5.4v3.1c0 1.3 1.9 2.6 4.3 2.6s4.3-1.3 4.3-2.6v-3.1L16 17.7l-4.3-2.1Z"
        fill="white"
        fillOpacity="0.95"
      />
    </svg>
  );
}

/**
 * Fondo "Bloom", el motivo de Windows 11: petalos de luz difuminados que
 * derivan despacio. Es CSS puro (sin JavaScript en cada fotograma) y se queda
 * quieto con `prefers-reduced-motion`.
 */
export function FondoBloom() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-fondo" aria-hidden>
      <div className="absolute -left-[20%] -top-[25%] h-[75vmax] w-[75vmax] animate-deriva rounded-full bg-[radial-gradient(closest-side,hsl(var(--bloom-1)/0.55),transparent)] blur-3xl" />
      <div className="absolute -bottom-[30%] -right-[15%] h-[70vmax] w-[70vmax] animate-deriva-lenta rounded-full bg-[radial-gradient(closest-side,hsl(var(--bloom-2)/0.5),transparent)] blur-3xl" />
      <div className="absolute left-[35%] top-[40%] h-[45vmax] w-[45vmax] animate-deriva rounded-full bg-[radial-gradient(closest-side,hsl(var(--bloom-3)/0.35),transparent)] blur-3xl [animation-delay:-12s]" />

      {/* Petalos: la silueta de Bloom, trazada con curvas y muy difuminada. */}
      <svg
        viewBox="0 0 800 800"
        className="absolute left-1/2 top-1/2 h-[140vmin] w-[140vmin] -translate-x-1/2 -translate-y-1/2 opacity-40 blur-2xl dark:opacity-50"
      >
        <g className="origin-center animate-deriva-lenta" style={{ transformBox: 'fill-box' }}>
          {[0, 72, 144, 216, 288].map((angulo, i) => (
            <path
              key={angulo}
              d="M400 400 C 330 300, 360 170, 400 110 C 440 170, 470 300, 400 400 Z"
              fill={`hsl(var(--${i % 2 ? 'bloom-2' : 'bloom-1'}) / 0.9)`}
              transform={`rotate(${angulo} 400 400)`}
            />
          ))}
        </g>
      </svg>

      {/* Grano, para que el degradado no se vea en bandas. */}
      <div className="grano absolute inset-0" />
    </div>
  );
}
