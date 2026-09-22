import type { Metadata } from 'next';
import { ProveedorSesion } from '@/componentes/sesion';
import './globals.css';

export const metadata: Metadata = {
  title: 'SecureCampus',
  description: 'Plataforma academica segura',
  // Un sistema academico interno no tiene por que aparecer en buscadores.
  robots: { index: false, follow: false },
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <a href="#contenido" className="salto-contenido">
          Saltar al contenido principal
        </a>
        <ProveedorSesion>{children}</ProveedorSesion>
      </body>
    </html>
  );
}
