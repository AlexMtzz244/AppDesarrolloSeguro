'use client';

import {
  Dismiss20Regular,
  Document20Filled,
  Document20Regular,
  HatGraduation20Filled,
  HatGraduation20Regular,
  History20Filled,
  History20Regular,
  Home20Filled,
  Home20Regular,
  MailInbox20Filled,
  MailInbox20Regular,
  Navigation20Regular,
  PanelLeftContract20Regular,
  PanelLeftExpand20Regular,
  People20Filled,
  People20Regular,
  PeopleTeam20Filled,
  PeopleTeam20Regular,
  Person20Filled,
  Person20Regular,
  ShieldError20Filled,
  ShieldError20Regular,
  Signature20Filled,
  Signature20Regular,
  SignOut20Regular,
  type FluentIcon,
} from '@fluentui/react-icons';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import type { Permiso } from '@securecampus/contracts';
import { CURVA_DECELERAR } from '@/componentes/movimiento';
import { useSesion } from '@/componentes/sesion';
import { AlternadorTema } from '@/componentes/tema';
import { BarraMensaje, EstadoCargando } from '@/componentes/ui';
import { Logotipo } from '@/componentes/marca';
import { cn } from '@/lib/utilidades';

interface Entrada {
  readonly href: string;
  readonly etiqueta: string;
  readonly icono: FluentIcon;
  readonly iconoActivo: FluentIcon;
  /** Permiso que hace VISIBLE la entrada. No es lo que la autoriza. */
  readonly permiso: Permiso;
}

const NAVEGACION: readonly Entrada[] = [
  { href: '/panel', etiqueta: 'Inicio', icono: Home20Regular, iconoActivo: Home20Filled, permiso: 'perfil:leer' },
  { href: '/panel/perfil', etiqueta: 'Mi perfil', icono: Person20Regular, iconoActivo: Person20Filled, permiso: 'perfil:leer' },
  {
    href: '/panel/calificaciones',
    etiqueta: 'Calificaciones',
    icono: HatGraduation20Regular,
    iconoActivo: HatGraduation20Filled,
    permiso: 'calificacion:leer',
  },
  { href: '/panel/grupos', etiqueta: 'Grupos', icono: PeopleTeam20Regular, iconoActivo: PeopleTeam20Filled, permiso: 'grupo:leer' },
  { href: '/panel/documentos', etiqueta: 'Documentos', icono: Document20Regular, iconoActivo: Document20Filled, permiso: 'documento:leer' },
  { href: '/panel/solicitudes', etiqueta: 'Solicitudes', icono: MailInbox20Regular, iconoActivo: MailInbox20Filled, permiso: 'solicitud:leer' },
  { href: '/panel/usuarios', etiqueta: 'Usuarios', icono: People20Regular, iconoActivo: People20Filled, permiso: 'usuario:leer' },
  {
    href: '/panel/auditoria',
    etiqueta: 'Auditoria',
    icono: History20Regular,
    iconoActivo: History20Filled,
    permiso: 'auditoria:consultar',
  },
  { href: '/panel/alertas', etiqueta: 'Alertas', icono: ShieldError20Regular, iconoActivo: ShieldError20Filled, permiso: 'alerta:consultar' },
  // Visible para cualquier usuario autenticado a proposito: el mecanismo de
  // decisiones existe para que las propuestas sin firmar NO sean invisibles.
  // Restringirlo a administradores volveria a esconder lo que expone.
  { href: '/panel/decisiones', etiqueta: 'Decisiones', icono: Signature20Regular, iconoActivo: Signature20Filled, permiso: 'perfil:leer' },
];

const CLAVE_COMPACTO = 'sc-menu-compacto';

/**
 * Area autenticada, con la estructura de una app de Windows 11: barra de
 * titulo acrilica y NavigationView lateral sobre Mica.
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
  const [compacto, setCompacto] = React.useState(false);
  const [cajonAbierto, setCajonAbierto] = React.useState(false);

  React.useEffect(() => {
    if (!cargando && !actor) router.replace('/ingresar');
  }, [cargando, actor, router]);

  // Preferencia de este navegador; si el almacenamiento no esta disponible,
  // el menu simplemente arranca expandido.
  React.useEffect(() => {
    try {
      setCompacto(localStorage.getItem(CLAVE_COMPACTO) === '1');
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  // Navegar cierra el cajon movil.
  React.useEffect(() => setCajonAbierto(false), [ruta]);

  function alternarCompacto() {
    setCompacto((actual) => {
      try {
        localStorage.setItem(CLAVE_COMPACTO, actual ? '0' : '1');
      } catch {
        /* sin almacenamiento */
      }
      return !actual;
    });
  }

  if (cargando) {
    return (
      <div className="mica flex min-h-screen items-center justify-center">
        <EstadoCargando etiqueta="Verificando sesion" />
      </div>
    );
  }

  if (!actor) return null;

  const visibles = NAVEGACION.filter((entrada) => actor.permisos.includes(entrada.permiso));
  const avisoMfa = actor.mfaObligatorio && !actor.mfaActivo;

  const pie = (conTexto: boolean) => (
    <div className="space-y-2 px-2 pb-3 pt-2">
      {avisoMfa && conTexto ? (
        // Un aviso, no un bloqueo: la API ya rechaza las operaciones
        // sensibles de esta cuenta hasta que configure el segundo factor.
        <BarraMensaje tono="aviso" role="alert" className="text-xs">
          Tu rol exige segundo factor.{' '}
          <Link href="/panel/perfil" className="font-semibold underline">
            Configuralo
          </Link>
          .
        </BarraMensaje>
      ) : null}
      <button
        type="button"
        onClick={() => void cerrarSesion()}
        title={conTexto ? undefined : 'Cerrar sesion'}
        className={cn(
          'flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-texto',
          'transition-colors duration-rapido hover:bg-texto/[0.06] active:bg-texto/[0.1]',
          !conTexto && 'justify-center px-0',
        )}
      >
        <SignOut20Regular className="shrink-0" aria-hidden />
        <span className={cn(!conTexto && 'sr-only')}>Cerrar sesion</span>
      </button>
    </div>
  );

  return (
    <div className="mica flex min-h-screen flex-col">
      {/* Barra de titulo */}
      <header className="acrilico sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-borde/60 px-2 sm:px-3">
        <Dialog.Root open={cajonAbierto} onOpenChange={setCajonAbierto}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Abrir menu"
              className="grid h-8 w-8 place-items-center rounded-md hover:bg-texto/[0.06] lg:hidden"
            >
              <Navigation20Regular aria-hidden />
            </button>
          </Dialog.Trigger>
          <CajonMovil
            abierto={cajonAbierto}
            entradas={visibles}
            ruta={ruta}
            pie={pie(true)}
          />
        </Dialog.Root>

        <button
          type="button"
          onClick={alternarCompacto}
          aria-label={compacto ? 'Expandir menu' : 'Contraer menu'}
          aria-expanded={!compacto}
          className="hidden h-8 w-8 place-items-center rounded-md hover:bg-texto/[0.06] lg:grid"
        >
          {compacto ? <PanelLeftExpand20Regular aria-hidden /> : <PanelLeftContract20Regular aria-hidden />}
        </button>

        <Link href="/panel" className="flex items-center gap-2.5 rounded-md px-1.5 py-1">
          <Logotipo className="h-6 w-6" />
          <span className="text-sm font-semibold">SecureCampus</span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <AlternadorTema />
          <Persona nombre={actor.nombre} correo={actor.correo} />
        </div>
      </header>

      <div className="flex flex-1">
        {/* NavigationView de escritorio */}
        <motion.aside
          initial={false}
          animate={{ width: compacto ? 64 : 272 }}
          transition={{ duration: 0.3, ease: CURVA_DECELERAR }}
          className="sticky top-12 hidden h-[calc(100vh-3rem)] shrink-0 flex-col overflow-hidden lg:flex"
        >
          <nav aria-label="Secciones" className="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-2">
            <ListaNavegacion entradas={visibles} ruta={ruta} compacto={compacto} idIndicador="escritorio" />
          </nav>
          {pie(!compacto)}
        </motion.aside>

        {/* Capa de contenido: la "hoja" ligeramente elevada de Windows 11. */}
        <main
          id="contenido"
          className="min-w-0 flex-1 bg-fondo/50 px-4 py-6 sm:px-6 lg:rounded-tl-lg lg:border-l lg:border-t lg:border-borde/60 lg:px-10 lg:py-8"
        >
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function ListaNavegacion({
  entradas,
  ruta,
  compacto,
  idIndicador,
}: {
  readonly entradas: readonly Entrada[];
  readonly ruta: string;
  readonly compacto: boolean;
  readonly idIndicador: string;
}) {
  return (
    <ul className="space-y-1">
      {entradas.map((entrada, indice) => {
        const activa = entrada.href === '/panel' ? ruta === '/panel' : ruta.startsWith(entrada.href);
        const Icono = activa ? entrada.iconoActivo : entrada.icono;
        return (
          <motion.li
            key={entrada.href}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: CURVA_DECELERAR, delay: 0.03 * indice }}
          >
            <Link
              href={entrada.href}
              aria-current={activa ? 'page' : undefined}
              title={compacto ? entrada.etiqueta : undefined}
              className={cn(
                'group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm',
                'transition-colors duration-rapido',
                activa
                  ? 'bg-texto/[0.07] font-semibold text-texto'
                  : 'text-texto/85 hover:bg-texto/[0.05] active:bg-texto/[0.08]',
                compacto && 'justify-center px-0',
              )}
            >
              {/* Indicador de seleccion de Windows 11: una sola pildora que se
                  desliza de una entrada a otra. */}
              {activa ? (
                <motion.span
                  layoutId={`indicador-nav-${idIndicador}`}
                  className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primario"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  aria-hidden
                />
              ) : null}
              <Icono
                className={cn(
                  'shrink-0 transition-transform duration-normal ease-fluent-decelerate group-hover:scale-110',
                  activa && 'text-primario',
                )}
                aria-hidden
              />
              <span className={cn('truncate', compacto && 'sr-only')}>{entrada.etiqueta}</span>
            </Link>
          </motion.li>
        );
      })}
    </ul>
  );
}

function CajonMovil({
  abierto,
  entradas,
  ruta,
  pie,
}: {
  readonly abierto: boolean;
  readonly entradas: readonly Entrada[];
  readonly ruta: string;
  readonly pie: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {abierto ? (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          </Dialog.Overlay>
          <Dialog.Content asChild forceMount aria-describedby={undefined}>
            <motion.div
              className="acrilico grano fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col border-r border-borde/60 shadow-elevacion-64"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.367, ease: CURVA_DECELERAR }}
            >
              <div className="flex h-12 items-center justify-between px-3">
                <Dialog.Title className="flex items-center gap-2.5 text-sm font-semibold">
                  <Logotipo className="h-6 w-6" />
                  SecureCampus
                </Dialog.Title>
                <Dialog.Close
                  aria-label="Cerrar menu"
                  className="grid h-8 w-8 place-items-center rounded-md hover:bg-texto/[0.06]"
                >
                  <Dismiss20Regular aria-hidden />
                </Dialog.Close>
              </div>
              <nav aria-label="Secciones" className="flex-1 overflow-y-auto px-2 pt-1">
                <ListaNavegacion entradas={entradas} ruta={ruta} compacto={false} idIndicador="movil" />
              </nav>
              {pie}
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </AnimatePresence>
  );
}

/** Persona de Fluent: avatar con iniciales y un color estable por nombre. */
function Persona({ nombre, correo }: { readonly nombre: string; readonly correo: string }) {
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('');

  let semilla = 0;
  for (const letra of correo) semilla = (semilla * 31 + letra.charCodeAt(0)) % 360;

  return (
    <div className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-1 sm:pr-2" title={correo}>
      <span
        className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white shadow-elevacion-2"
        style={{
          background: `linear-gradient(135deg, hsl(${semilla} 65% 45%), hsl(${(semilla + 40) % 360} 70% 38%))`,
        }}
        aria-hidden
      >
        {iniciales}
        {/* Presencia: la sesion esta activa. */}
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-tarjeta bg-exito" />
      </span>
      <span className="hidden min-w-0 leading-tight md:block">
        <span className="block max-w-[14rem] truncate text-xs font-semibold">{nombre}</span>
        <span className="block max-w-[14rem] truncate text-[11px] text-tenue">{correo}</span>
      </span>
    </div>
  );
}
