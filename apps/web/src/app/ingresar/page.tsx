'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as React from 'react';
import {
  esquemaSolicitudLogin,
  esquemaVerificacionMfa,
  type RespuestaLogin,
} from '@securecampus/contracts';
import { Boton, Campo, Entrada, EstadoError, Panel } from '@/componentes/ui';
import { useSesion } from '@/componentes/sesion';
import { api, ErrorDeApi } from '@/lib/api';

/**
 * Inicio de sesion en dos pasos (RF-001, RF-003).
 *
 * El segundo paso solo aparece si el servidor lo pide. El cliente no decide si
 * hace falta MFA ni puede saltarselo: hasta que no verifica el codigo, no
 * existe cookie de sesion.
 *
 * Nota que ningun mensaje de error de esta pantalla distingue entre "esa
 * cuenta no existe" y "esa contrasena es incorrecta". El texto viene del
 * servidor tal cual, y es identico en ambos casos (RNFS-016). Mejorarlo aqui
 * —"¿quisiste decir otro correo?"— deshace el control.
 */
export default function PaginaIngresar() {
  const router = useRouter();
  const { refrescar } = useSesion();

  const [paso, setPaso] = React.useState<'credenciales' | 'mfa'>('credenciales');
  const [desafio, setDesafio] = React.useState<string>('');
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);
  const [campos, setCampos] = React.useState<Record<string, string[]>>({});

  const refCodigo = React.useRef<HTMLInputElement>(null);

  // Al pasar al segundo factor, el foco se mueve al campo del codigo. Sin
  // esto, quien navega con teclado o lector de pantalla se queda en el boton
  // anterior y no percibe que la pantalla cambio (RNFS-060).
  React.useEffect(() => {
    if (paso === 'mfa') refCodigo.current?.focus();
  }, [paso]);

  async function enviarCredenciales(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setCampos({});

    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    const validacion = esquemaSolicitudLogin.safeParse(datos);

    if (!validacion.success) {
      // Validacion local: es cortesia con el usuario, no un control. El
      // servidor vuelve a validar exactamente lo mismo.
      setCampos(agrupar(validacion.error.issues));
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await api.post<RespuestaLogin>('/auth/login', validacion.data);

      if (respuesta.resultado === 'mfa-requerido') {
        setDesafio(respuesta.desafio);
        setPaso('mfa');
        return;
      }

      await refrescar();
      router.push('/panel');
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
      if (e instanceof ErrorDeApi && e.campos) setCampos(e.campos);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    const validacion = esquemaVerificacionMfa.safeParse({ ...datos, desafio });

    if (!validacion.success) {
      setCampos(agrupar(validacion.error.issues));
      return;
    }

    setEnviando(true);
    try {
      await api.post('/auth/mfa/verificar', validacion.data);
      await refrescar();
      router.push('/panel');
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main id="contenido" className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">SecureCampus</h1>
          <p className="text-sm text-tenue">
            {paso === 'credenciales'
              ? 'Ingresa con tu correo institucional.'
              : 'Escribe el codigo de tu aplicacion de autenticacion.'}
          </p>
        </header>

        {error ? (
          <EstadoError mensaje={error.message} correlationId={error.correlationId} />
        ) : null}

        <Panel>
          {paso === 'credenciales' ? (
            <form onSubmit={enviarCredenciales} className="space-y-4" noValidate>
              <Campo
                id="correo"
                etiqueta="Correo institucional"
                requerido
                error={campos['correo']?.[0]}
              >
                {(props) => (
                  <Entrada
                    {...props}
                    name="correo"
                    type="email"
                    autoComplete="username"
                    autoFocus
                  />
                )}
              </Campo>

              <Campo
                id="contrasena"
                etiqueta="Contrasena"
                requerido
                error={campos['contrasena']?.[0]}
              >
                {(props) => (
                  <Entrada
                    {...props}
                    name="contrasena"
                    type="password"
                    autoComplete="current-password"
                  />
                )}
              </Campo>

              <Boton type="submit" className="w-full" cargando={enviando}>
                Ingresar
              </Boton>
            </form>
          ) : (
            <form onSubmit={enviarCodigo} className="space-y-4" noValidate>
              <Campo
                id="codigo"
                etiqueta="Codigo de verificacion"
                ayuda="Seis digitos, cambia cada 30 segundos."
                requerido
                error={campos['codigo']?.[0]}
              >
                {(props) => (
                  <Entrada
                    {...props}
                    ref={refCodigo}
                    name="codigo"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="text-center font-mono text-lg tracking-[0.4em]"
                  />
                )}
              </Campo>

              <Boton type="submit" className="w-full" cargando={enviando}>
                Verificar
              </Boton>

              <Boton
                type="button"
                variante="texto"
                className="w-full"
                onClick={() => {
                  setPaso('credenciales');
                  setDesafio('');
                  setError(null);
                }}
              >
                Usar otra cuenta
              </Boton>
            </form>
          )}
        </Panel>

        {paso === 'credenciales' ? (
          <p className="text-center text-sm">
            <Link href="/recuperar" className="text-primario underline-offset-4 hover:underline">
              Olvide mi contrasena
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}

function agrupar(issues: { path: (string | number)[]; message: string }[]) {
  const campos: Record<string, string[]> = {};
  for (const issue of issues) {
    const clave = issue.path.join('.') || '_';
    (campos[clave] ??= []).push(issue.message);
  }
  return campos;
}
