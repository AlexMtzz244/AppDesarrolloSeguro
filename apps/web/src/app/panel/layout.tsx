'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import {
  BookOpenCheck,
  FileText,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react';
import type { Permiso } from '@securecampus/contracts';
import { useSesion } from '@/componentes/sesion';
import { Boton, EstadoCargando } from '@/componentes/ui';
import { cn } from '@/lib/utilidades';

interface Entrada {
  readonly href: string;
  readonly etiqueta: string;
  readonly icono: React.ComponentType<{ className?: string }>;
  /** Permiso que hace VISIBLE la entrada. No es lo que la autoriza. */
  readonly permiso: Permiso;
}

const NAVEGACION: readonly Entrada[] = [
  { href: '/panel', etiqueta: 'Inicio', icono: LayoutDashboard, permiso: 'perfil:leer' },
  { href: '/panel/perfil', etiqueta: 'Mi perfil', icono: User, permiso: 'perfil:leer' },
  {
    href: '/panel/calificaciones',
    etiqueta: 'Calificaciones',
    icono: GraduationCap,
    permiso: 'calificacion:leer',
  },
  { href: '/panel/grupos', etiqueta: 'Grupos', icono: BookOpenCheck, permiso: 'grupo:leer' },
  { href: '/panel/documentos', etiqueta: 'Documentos', icono: FileText, permiso: 'documento:leer' },
  { href: '/panel/solicitudes', etiqueta: 'Solicitudes', icono: Inbox, permiso: 'solicitud:leer' },
  { href: '/panel/usuarios', etiqueta: 'Usuarios', icono: Users, permiso: 'usuario:leer' },
  {
    href: '/panel/auditoria',
    etiqueta: 'Auditoria',
    icono: ScrollText,
    permiso: 'auditoria:consultar',
  },
  { href: '/panel/alertas', etiqueta: 'Alertas', icono: ShieldAlert, permiso: 'alerta:consultar' },
];

/**
 * Area autenticada.
 *
 * # Sobre el filtrado del menu
 *
 * La navegacion se filtra por permiso, y eso es **solo experiencia de
 * usuario**. Cada ruta de la API vuelve a verificar contra la sesion del
 * servidor.
 *
 * SC-LAB-001 escenario 4 describe el error contrario: "La interfaz oculta el
 * menu de administracion a los estudiantes, pero el endpoint `/admin/usuarios`
 * sigue respondiendo a cualquier sesion autenticada que lo invoque
 * directamente." Aqui, invocarlo directamente devuelve 403, y hay una prueba
 * de integracion que lo comprueba en cada build.
 *
 * Dicho de otro modo: si alguien parchea este arreglo desde la consola del
 * navegador, vera enlaces nuevos que no llevan a ninguna parte.
 */
export default function LayoutPanel({ children }: { readonly children: React.ReactNode }) {
  const { actor, cargando, cerrarSesion } = useSesion();
  const router = useRouter();
  const ruta = usePathname();

  React.useEffect(() => {
    if (!cargando && !actor) router.replace('/ingresar');
  }, [cargando, actor, router]);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EstadoCargando etiqueta="Verificando sesion" />
      </div>
    );
  }

  if (!actor) return null;

  const visibles = NAVEGACION.filter((entrada) => actor.permisos.includes(entrada.permiso));

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-borde bg-panel lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:block">
          <div>
            <p className="text-sm font-semibold">SecureCampus</p>
            <p className="truncate text-xs text-tenue" title={actor.correo}>
              {actor.nombre}
            </p>
          </div>
        </div>

        <nav aria-label="Secciones" className="px-2 pb-3">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {visibles.map((entrada) => {
              const activa =
                entrada.href === '/panel' ? ruta === '/panel' : ruta.startsWith(entrada.href);
              const Icono = entrada.icono;
              return (
                <li key={entrada.href}>
                  <Link
                    href={entrada.href}
                    aria-current={activa ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      activa
                        ? 'bg-primario text-primario-contraste'
                        : 'text-texto hover:bg-borde/60',
                    )}
                  >
                    <Icono className="h-4 w-4 shrink-0" aria-hidden />
                    {entrada.etiqueta}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-borde px-2 py-3">
          {actor.mfaObligatorio && !actor.mfaActivo ? (
            // Un aviso, no un bloqueo: la API ya rechaza las operaciones
            // sensibles de esta cuenta hasta que configure el segundo factor.
            <p
              role="alert"
              className="mb-2 rounded-md border border-aviso/40 bg-aviso/10 px-3 py-2 text-xs text-aviso"
            >
              Tu rol exige segundo factor.{' '}
              <Link href="/panel/perfil" className="underline">
                Configuralo
              </Link>
              .
            </p>
          ) : null}

          <Boton
            variante="tenue"
            tamano="sm"
            className="w-full justify-start"
            onClick={() => void cerrarSesion()}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Cerrar sesion
          </Boton>
        </div>
      </aside>

      <main id="contenido" className="flex-1 bg-fondo px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">{children}</div>
      </main>
    </div>
  );
}
