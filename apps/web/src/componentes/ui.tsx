'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utilidades';

/**
 * Componentes base, sobre las primitivas accesibles de Radix (las mismas que
 * usa shadcn/ui).
 *
 * El diseno responde al requisito de INTERFAZ del prompt maestro: sobrio,
 * denso pero legible, de herramienta operativa. Nada decorativo.
 *
 * Dos cosas que aqui son de seguridad y no de estetica:
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
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ' +
    'transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variante: {
        primario: 'bg-primario text-primario-contraste hover:bg-primario/90',
        contorno: 'border border-borde bg-transparent hover:bg-panel',
        tenue: 'bg-panel text-panel-contraste hover:bg-borde',
        // Rojo pleno, sin matices. Una accion destructiva debe parecerlo.
        peligro: 'bg-peligro text-peligro-contraste hover:bg-peligro/90',
        texto: 'bg-transparent underline-offset-4 hover:underline',
      },
      tamano: {
        sm: 'h-8 px-3 text-xs',
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
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
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

// --- Campo de formulario ---------------------------------------------------

export const Etiqueta = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-sm font-medium leading-none', className)}
    {...props}
  />
));
Etiqueta.displayName = 'Etiqueta';

export const Entrada = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-md border border-entrada bg-fondo px-3 py-1 text-sm',
      'placeholder:text-tenue disabled:cursor-not-allowed disabled:opacity-50',
      'aria-[invalid=true]:border-peligro',
      className,
    )}
    {...props}
  />
));
Entrada.displayName = 'Entrada';

export const AreaTexto = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-md border border-entrada bg-fondo px-3 py-2 text-sm',
      'placeholder:text-tenue aria-[invalid=true]:border-peligro',
      className,
    )}
    {...props}
  />
));
AreaTexto.displayName = 'AreaTexto';

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
        <p id={idError} role="alert" className="text-xs font-medium text-peligro">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// --- Contenedores ----------------------------------------------------------

export function Panel({
  titulo,
  descripcion,
  acciones,
  className,
  children,
}: {
  readonly titulo?: string | undefined;
  readonly descripcion?: string | undefined;
  readonly acciones?: React.ReactNode;
  readonly className?: string | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-lg border border-borde bg-fondo', className)}>
      {titulo ? (
        <header className="flex items-start justify-between gap-4 border-b border-borde px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{titulo}</h2>
            {descripcion ? <p className="mt-0.5 text-xs text-tenue">{descripcion}</p> : null}
          </div>
          {acciones}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

// --- Estados ---------------------------------------------------------------

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
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-peligro/40 bg-peligro/5 p-4"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-peligro" aria-hidden />
      <div className="flex-1 space-y-2">
        <p className="text-sm">{mensaje}</p>
        {correlationId ? (
          <p className="font-mono text-xs text-tenue">Referencia: {correlationId}</p>
        ) : null}
        {onReintentar ? (
          <Boton variante="contorno" tamano="sm" onClick={onReintentar}>
            Reintentar
          </Boton>
        ) : null}
      </div>
    </div>
  );
}

export function EstadoCargando({ etiqueta = 'Cargando' }: { readonly etiqueta?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-tenue" role="status" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {etiqueta}…
    </div>
  );
}

export function EstadoVacio({ mensaje }: { readonly mensaje: string }) {
  return <p className="p-6 text-center text-sm text-tenue">{mensaje}</p>;
}

// --- Insignia de estado ----------------------------------------------------

const variantesInsignia = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
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

export function Insignia({
  tono,
  children,
}: VariantProps<typeof variantesInsignia> & { readonly children: React.ReactNode }) {
  return <span className={variantesInsignia({ tono })}>{children}</span>;
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
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
    className={cn('border-b border-borde px-3 py-2 text-left font-medium text-tenue', className)}
  >
    {children}
  </th>
);

export const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn('border-b border-borde/60 px-3 py-2', className)}>{children}</td>
);
