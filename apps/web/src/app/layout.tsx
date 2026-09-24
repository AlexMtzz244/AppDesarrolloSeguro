import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ProveedorMovimiento } from '@/componentes/movimiento';
import { ProveedorSesion } from '@/componentes/sesion';
import { SCRIPT_TEMA } from '@/componentes/tema';
import './globals.css';

// Respaldo de Segoe UI fuera de Windows. `next/font` la descarga al compilar y
// la sirve desde el propio dominio: el navegador no contacta a Google.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--fuente-inter' });

export const metadata: Metadata = {
  title: 'SecureCampus',
  description: 'Plataforma academica segura',
  // Un sistema academico interno no tiene por que aparecer en buscadores.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f3f3' },
    { media: '(prefers-color-scheme: dark)', color: '#202020' },
  ],
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <a href="#contenido" className="salto-contenido">
          Saltar al contenido principal
        </a>
        <ProveedorMovimiento>
          <ProveedorSesion>{children}</ProveedorSesion>
        </ProveedorMovimiento>
      </body>
    </html>
  );
}
