'use client';

import {
  CheckmarkCircle20Filled,
  ChevronDown16Regular,
  DismissCircle20Filled,
  DocumentSearch24Regular,
  ErrorCircle20Filled,
  Info20Filled,
  Warning20Filled,
  type FluentIcon,
} from '@fluentui/react-icons';
import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { manejarRevelar } from '@/componentes/movimiento';
import { cn } from '@/lib/utilidades';

/**
 * Componentes base con el lenguaje de Fluent 2, sobre las primitivas
 * accesibles de Radix (las mismas que usa shadcn/ui).
 *
 * Dos cosas que aqui son de seguridad y no de estetica, y que el rediseno no
 * toca:
 *
 * - **Ninguna variante oculta el riesgo de una accion.** Un boton destructivo
 *   se ve destructivo. El prompt maestro lo pide explicitamente: "sin...
 *   controles que oculten riesgos".
 * - **Todo campo lleva su etiqueta y su error asociados por `id`.** No es
 *   cortesia: sin la asociacion, un lector de pantalla anuncia un campo sin
 *   nombre y el error no se lee nunca (RNFS-060).
 */

// --- Boton -----------------------------------------------------------------

const variantesBoton = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md ' +
    'text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] ' +
    'duration-rapido ease-fluent-decelerate active:scale-[0.97] ' +
    'disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
  {
    variants: {
      variante: {
        primario:
          'bg-primario text-primario-contraste shadow-elevacion-2 hover:bg-primario/90 active:bg-primario/80',
        contorno:
          'border border-entrada bg-tarjeta text-texto shadow-elevacion-2 hover:border-tenue/60 hover:bg-panel active:bg-texto/[0.06]',
        tenue: 'bg-transparent text-texto hover:bg-texto/[0.06] active:bg-texto/[0.1]',
        // Rojo pleno, sin matices. Una accion destructiva debe parecerlo.
        peligro:
          'bg-peligro text-peligro-contraste shadow-elevacion-2 hover:bg-peligro/90 active:bg-peligro/80',
        texto: 'bg-transparent font-medium text-primario underline-offset-4 hover:underline',
      },
      tamano: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-10 px-6',
      },
    },
    defaultVariants: { variante: 'primario', tamano: 'md' },
  },
);

export interface PropsBoton
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variantesBoton> {
  readonly asChild?: boolean;
  readonly cargando?: boolean;
}

export const Boton = React.forwardRef<HTMLButtonElement, PropsBoton>(
  ({ className, variante, tamano, asChild = false, cargando, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(variantesBoton({ variante, tamano }), className)}
        disabled={props.disabled ?? cargando}
        {...props}
      >
        {/* Con `asChild` el hijo se entrega TAL CUAL. `Slot` exige un unico
            elemento, y el `null` del indicador de carga ya cuenta como un
            segundo hijo: bastaba eso para que el render fallara con "Slot
            failed to slot onto its children" y se cayera la compilacion de la
            pagina. Ademas el indicador no tendria donde dibujarse, porque en
            ese modo quien renderiza es el hijo. */}
        {asChild ? (
          children
        ) : (
          <>
            {cargando ? (
              <>
                <Giro className="h-4 w-4" />
                {/* El estado de carga se anuncia, no solo se dibuja. */}
                <span className="sr-only">Procesando</span>
              </>
            ) : null}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Boton.displayName = 'Boton';

/** Spinner de Fluent: un arco que crece y se encoge mientras gira. */
export function Giro({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 50 50" className={cn('animate-giro-fluent', className)} aria-hidden>
      <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="5" />
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        className="animate-arco-fluent"
      />
    </svg>
  );
}

// --- Campo de formulario ---------------------------------------------------

export const Etiqueta = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-sm font-semibold leading-none', className)}
    {...props}
  />
));
Etiqueta.displayName = 'Etiqueta';

/*
 * Control de texto de Fluent: borde tenue, linea inferior mas oscura y, al
 * enfocar, una barra de acento que crece desde el centro. Esa barra ES el
 * indicador de foco (RNFS-060), por eso reemplaza al anillo general.
 */
const clasesControl = cn(
  'w-full rounded-md border border-entrada border-b-tenue/70 bg-tarjeta text-sm text-texto',
  'bg-[linear-gradient(hsl(var(--primario)),hsl(var(--primario)))] bg-no-repeat',
  'bg-[length:0%_2px] bg-[position:50%_100%]',
  'transition-[background-size,border-color] duration-normal ease-fluent-decelerate',
  'hover:border-tenue/60 hover:border-b-texto/70',
  'focus-visible:bg-[length:100%_2px] focus-visible:border-b-primario focus-visible:ring-0 focus-visible:ring-offset-0',
  'placeholder:text-tenue disabled:cursor-not-allowed disabled:opacity-50',
  'aria-[invalid=true]:border-peligro aria-[invalid=true]:border-b-peligro',
  'aria-[invalid=true]:bg-[linear-gradient(hsl(var(--peligro)),hsl(var(--peligro)))]',
);

export const Entrada = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(clasesControl, 'flex h-9 px-3 py-1', className)} {...props} />
));
Entrada.displayName = 'Entrada';

export const AreaTexto = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(clasesControl, 'flex min-h-[88px] px-3 py-2', className)} {...props} />
));
AreaTexto.displayName = 'AreaTexto';

/** Desplegable de Fluent sobre un `<select>` nativo: accesible sin trabajo extra. */
export const Selector = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(clasesControl, 'flex h-9 cursor-pointer appearance-none pl-3 pr-9', className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown16Regular
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tenue"
      aria-hidden
    />
  </div>
));
Selector.displayName = 'Selector';

interface PropsCampo {
  readonly id: string;
  readonly etiqueta: string;
  readonly ayuda?: string;
  readonly error?: string | undefined;
  readonly requerido?: boolean;
  readonly children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
    'aria-required': boolean;
  }) => React.ReactNode;
}

/**
 * Envoltorio que garantiza la asociacion etiqueta-campo-error.
 *
 * Existe para que sea mas facil hacerlo bien que mal: el componente calcula
 * los `id` y las relaciones ARIA, de modo que un formulario nuevo nace
 * accesible sin que nadie recuerde las reglas.
 */
export function Campo({ id, etiqueta, ayuda, error, requerido, children }: PropsCampo) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const descrito = [idAyuda, idError].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <Etiqueta htmlFor={id}>
        {etiqueta}
        {requerido ? (
          <span className="ml-1 text-peligro" aria-hidden>
            *
          </span>
        ) : null}
        {requerido ? <span className="sr-only"> (obligatorio)</span> : null}
      </Etiqueta>

      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': descrito,
        'aria-required': Boolean(requerido),
      })}

      {ayuda ? (
        <p id={idAyuda} className="text-xs text-tenue">
          {ayuda}
        </p>
      ) : null}

      {error ? (
        // `role="alert"` hace que el lector de pantalla lo anuncie al aparecer,
        // en vez de que el usuario tenga que ir a buscarlo.
        <p
          id={idError}
          role="alert"
          className="flex animate-entrada items-center gap-1 text-xs font-medium text-peligro"
        >
          <DismissCircle20Filled className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

// --- Contenedores ----------------------------------------------------------

/**
 * Tarjeta de Fluent: superficie elevada con el resaltado "revelar" que sigue
 * al puntero.
 */
export function Panel({
  titulo,
  descripcion,
  acciones,
  icono: Icono,
  className,
  children,
}: {
  readonly titulo?: string | undefined;
  readonly descripcion?: string | undefined;
  readonly acciones?: React.ReactNode;
  readonly icono?: FluentIcon | undefined;
  readonly className?: string | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <section
      onPointerMove={manejarRevelar}
      className={cn(
        'revelar revelar-borde animate-entrada rounded-lg border border-borde/70 bg-tarjeta shadow-elevacion-4',
        'transition-shadow duration-normal ease-fluent-decelerate hover:shadow-elevacion-8',
        className,
      )}
    >
      {titulo ? (
        <header className="flex items-start justify-between gap-4 px-5 pb-1 pt-4">
          <div className="flex items-start gap-3">
            {Icono ? (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primario-suave text-primario">
                <Icono className="h-5 w-5" aria-hidden />
              </span>
            ) : null}
            <div>
              <h2 className="text-base font-semibold leading-6">{titulo}</h2>
              {descripcion ? <p className="mt-0.5 text-xs text-tenue">{descripcion}</p> : null}
            </div>
          </div>
          <div className="relative z-10">{acciones}</div>
        </header>
      ) : null}
      {/* `z-10` deja el contenido por encima del resaltado, para que no tine
          el texto ni intercepte clics. */}
      <div className="relative z-10 p-5">{children}</div>
    </section>
  );
}

/** Cabecera de pagina: titulo grande estilo Windows 11 con icono y acciones. */
export function EncabezadoPagina({
  titulo,
  descripcion,
  icono: Icono,
  acciones,
}: {
  readonly titulo: React.ReactNode;
  readonly descripcion?: React.ReactNode;
  readonly icono?: FluentIcon | undefined;
  readonly acciones?: React.ReactNode;
}) {
  return (
    <header className="flex animate-entrada flex-wrap items-end justify-between gap-4 pb-1">
      <div className="flex items-center gap-4">
        {Icono ? (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primario to-[hsl(var(--bloom-2))] text-white shadow-elevacion-8">
            <Icono className="h-6 w-6" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px] sm:leading-9">{titulo}</h1>
          {descripcion ? <p className="mt-0.5 text-sm text-tenue">{descripcion}</p> : null}
        </div>
      </div>
      {acciones ? <div className="flex items-center gap-2">{acciones}</div> : null}
    </header>
  );
}

// --- Estados ---------------------------------------------------------------

const variantesMensaje = cva(
  'relative flex animate-entrada items-start gap-3 overflow-hidden rounded-md border py-3 pl-4 pr-4 text-sm ' +
    'before:absolute before:inset-y-0 before:left-0 before:w-1',
  {
    variants: {
      tono: {
        info: 'border-primario/25 bg-primario/[0.06] before:bg-primario',
        exito: 'border-exito/30 bg-exito/[0.07] before:bg-exito',
        aviso: 'border-aviso/30 bg-aviso/[0.08] before:bg-aviso',
        peligro: 'border-peligro/30 bg-peligro/[0.07] before:bg-peligro',
      },
    },
    defaultVariants: { tono: 'info' },
  },
);

const ICONOS_MENSAJE: Record<'info' | 'exito' | 'aviso' | 'peligro', FluentIcon> = {
  info: Info20Filled,
  exito: CheckmarkCircle20Filled,
  aviso: Warning20Filled,
  peligro: ErrorCircle20Filled,
};

const COLOR_ICONO = {
  info: 'text-primario',
  exito: 'text-exito',
  aviso: 'text-aviso',
  peligro: 'text-peligro',
} as const;

/** Barra de mensaje de Fluent (MessageBar). */
export function BarraMensaje({
  tono = 'info',
  children,
  className,
  ...props
}: VariantProps<typeof variantesMensaje> &
  React.HTMLAttributes<HTMLDivElement> & { readonly children: React.ReactNode }) {
  const clave = tono ?? 'info';
  const Icono = ICONOS_MENSAJE[clave];
  return (
    <div className={cn(variantesMensaje({ tono }), className)} {...props}>
      <Icono className={cn('mt-px h-5 w-5 shrink-0', COLOR_ICONO[clave])} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Estado de error con reintento (RNFS-061).
 *
 * Muestra el `correlationId`. Es el unico dato tecnico que se expone al
 * usuario, y es deliberado: le permite reportar el problema y al operador
 * encontrarlo en los logs, sin revelar nada del estado interno del servidor.
 */
export function EstadoError({
  mensaje,
  correlationId,
  onReintentar,
}: {
  readonly mensaje: string;
  readonly correlationId?: string | undefined;
  readonly onReintentar?: (() => void) | undefined;
}) {
  return (
    <BarraMensaje tono="peligro" role="alert">
      <div className="space-y-2">
        <p>{mensaje}</p>
        {correlationId ? (
          <p className="font-mono text-xs text-tenue">Referencia: {correlationId}</p>
        ) : null}
        {onReintentar ? (
          <Boton variante="contorno" tamano="sm" onClick={onReintentar}>
            Reintentar
          </Boton>
        ) : null}
      </div>
    </BarraMensaje>
  );
}

export function EstadoCargando({ etiqueta = 'Cargando' }: { readonly etiqueta?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4 p-2">
      <div className="flex items-center gap-3 text-sm text-tenue">
        <Giro className="h-5 w-5 text-primario" />
        {etiqueta}…
      </div>
      {/* Esqueleto: da la forma de lo que viene sin inventar datos. */}
      <div className="space-y-2.5" aria-hidden>
        <div className="esqueleto h-3.5 w-11/12" />
        <div className="esqueleto h-3.5 w-9/12" />
        <div className="esqueleto h-3.5 w-10/12" />
      </div>
    </div>
  );
}

export function EstadoVacio({ mensaje }: { readonly mensaje: string }) {
  return (
    <div className="flex animate-entrada flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-primario-suave text-primario">
        <DocumentSearch24Regular aria-hidden />
      </span>
      <p className="max-w-sm text-sm text-tenue">{mensaje}</p>
    </div>
  );
}

// --- Insignia de estado ----------------------------------------------------

const variantesInsignia = cva(
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      tono: {
        neutro: 'border-borde bg-panel text-tenue',
        exito: 'border-exito/30 bg-exito/10 text-exito',
        aviso: 'border-aviso/30 bg-aviso/10 text-aviso',
        peligro: 'border-peligro/30 bg-peligro/10 text-peligro',
      },
    },
    defaultVariants: { tono: 'neutro' },
  },
);

const PUNTO_INSIGNIA = {
  neutro: 'bg-tenue',
  exito: 'bg-exito',
  aviso: 'bg-aviso',
  peligro: 'bg-peligro',
} as const;

export function Insignia({
  tono,
  children,
}: VariantProps<typeof variantesInsignia> & { readonly children: React.ReactNode }) {
  const clave = tono ?? 'neutro';
  return (
    <span className={variantesInsignia({ tono })}>
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        {/* Lo que exige atencion late; lo demas se queda quieto. */}
        {clave === 'peligro' ? (
          <span className={cn('absolute inset-0 animate-latido rounded-full', PUNTO_INSIGNIA[clave])} />
        ) : null}
        <span className={cn('relative h-1.5 w-1.5 rounded-full', PUNTO_INSIGNIA[clave])} />
      </span>
      {children}
    </span>
  );
}

// --- Tabla -----------------------------------------------------------------

export function Tabla({
  resumen,
  children,
}: {
  readonly resumen: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="tabla-fluent -mx-5 overflow-x-auto px-5">
      <table className="w-full border-separate border-spacing-0 text-sm">
        {/* El resumen da contexto a quien navega con lector de pantalla y no
            ve la cabecera de la seccion. */}
        <caption className="sr-only">{resumen}</caption>
        {children}
      </table>
    </div>
  );
}

export const Th = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th
    scope="col"
    className={cn(
      'whitespace-nowrap border-b border-borde px-3 py-2.5 text-left text-xs font-semibold text-tenue',
      className,
    )}
  >
    {children}
  </th>
);

export const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn('border-b border-borde/50 px-3 py-2.5', className)}>{children}</td>
);
