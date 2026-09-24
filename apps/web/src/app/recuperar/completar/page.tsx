'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { esquemaContrasena } from '@securecampus/contracts';
import { CheckmarkCircle48Regular } from '@fluentui/react-icons';
import { MarcoAcceso } from '@/componentes/marco-acceso';
import { Boton, Campo, Entrada, EstadoCargando, EstadoError } from '@/componentes/ui';
import { api, ErrorDeApi } from '@/lib/api';

/**
 * Completa la recuperacion con el token del enlace (RF-010).
 *
 * El resultado es un booleano, no un mensaje distinto por caso. Un enlace
 * vencido, uno ya usado, uno sustituido por otro mas reciente y uno inventado
 * producen exactamente la misma pantalla (RNFS-023): decir cual de los cuatro
 * fue le confirmaria al atacante que la cuenta existe.
 */
function Formulario() {
  const parametros = useSearchParams();
  const token = parametros.get('token') ?? '';

  const [resultado, setResultado] = React.useState<'pendiente' | 'ok' | 'rechazado'>('pendiente');
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);
  const [campos, setCampos] = React.useState<Record<string, string[]>>({});

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setCampos({});

    const datos = new FormData(evento.currentTarget);
    const nueva = String(datos.get('contrasenaNueva') ?? '');
    const confirmacion = String(datos.get('confirmacion') ?? '');

    const validacion = esquemaContrasena.safeParse(nueva);
    if (!validacion.success) {
      setCampos({ contrasenaNueva: [validacion.error.issues[0]?.message ?? 'Invalida'] });
      return;
    }
    if (nueva !== confirmacion) {
      setCampos({ confirmacion: ['Las contrasenas no coinciden.'] });
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await api.post<{ completado: boolean }>('/auth/recuperacion/completar', {
        token,
        contrasenaNueva: nueva,
      });
      setResultado(respuesta.completado ? 'ok' : 'rechazado');
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
    } finally {
      setEnviando(false);
    }
  }

  if (resultado === 'ok') {
    return (
      <div>
        <div className="space-y-4" role="status">
          <CheckmarkCircle48Regular className="mx-auto text-exito" aria-hidden />
          <p className="text-sm font-medium">Tu contrasena se restablecio.</p>
          <p className="text-sm text-tenue">
            Todas las sesiones activas se cerraron, incluidas las de otros dispositivos. Vuelve a
            ingresar con tu contrasena nueva.
          </p>
          <Boton asChild className="w-full">
            <Link href="/ingresar">Ir a ingresar</Link>
          </Boton>
        </div>
      </div>
    );
  }

  if (resultado === 'rechazado') {
    return (
      <div>
        <div className="space-y-4" role="alert">
          <p className="text-sm font-medium">Este enlace ya no es valido.</p>
          {/* Se enumeran las cuatro causas posibles sin decir cual fue: el
              usuario legitimo reconoce la suya, y quien esta sondeando no
              obtiene ninguna senal. */}
          <p className="text-sm text-tenue">
            Puede haber vencido, haberse usado ya, o haber sido reemplazado por uno mas reciente.
            Solicita uno nuevo.
          </p>
          <Boton asChild variante="contorno" className="w-full">
            <Link href="/recuperar">Solicitar otro enlace</Link>
          </Boton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo
          id="contrasenaNueva"
          etiqueta="Contrasena nueva"
          ayuda="Minimo 12 caracteres. Una frase larga es mas segura que una palabra con simbolos."
          requerido
          error={campos['contrasenaNueva']?.[0]}
        >
          {(props) => (
            <Entrada
              {...props}
              name="contrasenaNueva"
              type="password"
              autoComplete="new-password"
              autoFocus
            />
          )}
        </Campo>

        <Campo
          id="confirmacion"
          etiqueta="Confirma la contrasena"
          requerido
          error={campos['confirmacion']?.[0]}
        >
          {(props) => (
            <Entrada {...props} name="confirmacion" type="password" autoComplete="new-password" />
          )}
        </Campo>

        {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

        <Boton type="submit" className="w-full" cargando={enviando} disabled={!token}>
          Restablecer contrasena
        </Boton>

        {!token ? (
          <p role="alert" className="text-xs font-medium text-peligro">
            El enlace no incluye el token necesario. Solicita uno nuevo.
          </p>
        ) : null}
      </form>
    </div>
  );
}

export default function PaginaCompletarRecuperacion() {
  return (
    <MarcoAcceso
      titulo="Nueva contrasena"
      descripcion="Elige una contrasena que no uses en ningun otro sitio."
    >
      <React.Suspense fallback={<EstadoCargando />}>
        <Formulario />
      </React.Suspense>
    </MarcoAcceso>
  );
}
