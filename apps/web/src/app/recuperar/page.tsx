'use client';

import Link from 'next/link';
import * as React from 'react';
import { esquemaSolicitudRecuperacion } from '@securecampus/contracts';
import { Boton, Campo, Entrada, EstadoError, Panel } from '@/componentes/ui';
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
    <main id="contenido" className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Recuperar acceso</h1>
          <p className="text-sm text-tenue">
            Te enviaremos un enlace para restablecer tu contrasena.
          </p>
        </header>

        {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

        <Panel>
          {enviado ? (
            <div className="space-y-4" role="status">
              <p className="text-sm">
                Si la cuenta existe, se envio un enlace de recuperacion al correo registrado.
              </p>
              <ul className="space-y-1 text-xs text-tenue">
                <li>El enlace vence en pocos minutos.</li>
                <li>Solo se puede usar una vez.</li>
                <li>Si solicitas otro, el anterior deja de funcionar.</li>
                <li>Al completarlo se cerraran todas tus sesiones activas.</li>
              </ul>
              <Boton asChild variante="contorno" className="w-full">
                <Link href="/ingresar">Volver a ingresar</Link>
              </Boton>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4" noValidate>
              <Campo
                id="correo"
                etiqueta="Correo institucional"
                requerido
                error={campos['correo']?.[0]}
              >
                {(props) => (
                  <Entrada {...props} name="correo" type="email" autoComplete="username" autoFocus />
                )}
              </Campo>

              <Boton type="submit" className="w-full" cargando={enviando}>
                Enviar enlace
              </Boton>

              <Boton asChild variante="texto" className="w-full">
                <Link href="/ingresar">Cancelar</Link>
              </Boton>
            </form>
          )}
        </Panel>
      </div>
    </main>
  );
}
