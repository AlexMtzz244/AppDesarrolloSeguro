'use client';

import Link from 'next/link';
import * as React from 'react';
import { esquemaSolicitudRecuperacion } from '@securecampus/contracts';
import { Checkmark16Regular, MailCheckmark24Regular } from '@fluentui/react-icons';
import { MarcoAcceso } from '@/componentes/marco-acceso';
import { Boton, Campo, Entrada, EstadoError } from '@/componentes/ui';
import { api, ErrorDeApi } from '@/lib/api';

/**
 * Solicitud de recuperacion (RF-010).
 *
 * # El detalle que parece un descuido de diseno y no lo es
 *
 * Al enviar, esta pantalla muestra SIEMPRE el mismo mensaje, exista o no la
 * cuenta. Es tentador "ayudar" al usuario con un "no encontramos ese correo",
 * y es exactamente lo que convierte este formulario en un enumerador de
 * correos institucionales validos (RNFS-020).
 *
 * El servidor ya devuelve una respuesta uniforme; esta pantalla no la deshace
 * mostrando algo distinto segun el caso.
 */
export default function PaginaRecuperar() {
  const [enviado, setEnviado] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);
  const [campos, setCampos] = React.useState<Record<string, string[]>>({});

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setCampos({});

    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    const validacion = esquemaSolicitudRecuperacion.safeParse(datos);

    if (!validacion.success) {
      setCampos({ correo: ['Escribe un correo electronico valido.'] });
      return;
    }

    setEnviando(true);
    try {
      await api.post('/auth/recuperacion/solicitar', validacion.data);
      setEnviado(true);
    } catch (e) {
      // Solo llega aqui un fallo real de red o del servidor. Un correo
      // inexistente devuelve 200 igual que uno valido.
      setError(e instanceof ErrorDeApi ? e : null);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso
      clave={enviado ? 'enviado' : 'formulario'}
      titulo={enviado ? 'Revisa tu correo' : 'Recuperar acceso'}
      descripcion={
        enviado
          ? 'Si la cuenta existe, se envio un enlace de recuperacion al correo registrado.'
          : 'Te enviaremos un enlace para restablecer tu contrasena.'
      }
    >
      {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

      {enviado ? (
        <div className="space-y-5" role="status">
          <div className="flex justify-center">
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-primario-suave text-primario">
              <span className="absolute inset-0 animate-latido rounded-full bg-primario/20" aria-hidden />
              <MailCheckmark24Regular aria-hidden />
            </span>
          </div>
          <ul className="space-y-2 text-sm text-tenue">
            {[
              'El enlace vence en pocos minutos.',
              'Solo se puede usar una vez.',
              'Si solicitas otro, el anterior deja de funcionar.',
              'Al completarlo se cerraran todas tus sesiones activas.',
            ].map((texto) => (
              <li key={texto} className="flex items-start gap-2">
                <Checkmark16Regular className="mt-0.5 shrink-0 text-exito" aria-hidden />
                {texto}
              </li>
            ))}
          </ul>
          <Boton asChild variante="contorno" tamano="lg" className="w-full">
            <Link href="/ingresar">Volver a ingresar</Link>
          </Boton>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-5" noValidate>
          <Campo id="correo" etiqueta="Correo institucional" requerido error={campos['correo']?.[0]}>
            {(props) => (
              <Entrada {...props} name="correo" type="email" autoComplete="username" autoFocus />
            )}
          </Campo>

          <Boton type="submit" tamano="lg" className="w-full" cargando={enviando}>
            Enviar enlace
          </Boton>

          <Boton asChild variante="texto" className="w-full">
            <Link href="/ingresar">Cancelar</Link>
          </Boton>
        </form>
      )}
    </MarcoAcceso>
  );
}
