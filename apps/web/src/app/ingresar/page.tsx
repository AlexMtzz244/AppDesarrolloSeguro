'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as React from 'react';
import {
  esquemaSolicitudLogin,
  esquemaVerificacionMfa,
  type RespuestaLogin,
} from '@securecampus/contracts';
import { ArrowLeft16Regular, ArrowRight16Regular, Key16Regular } from '@fluentui/react-icons';
import { MarcoAcceso } from '@/componentes/marco-acceso';
import { Boton, Campo, Entrada, EstadoError } from '@/componentes/ui';
import { useSesion } from '@/componentes/sesion';
import { api, ErrorDeApi } from '@/lib/api';
import { cn } from '@/lib/utilidades';

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
  const [codigo, setCodigo] = React.useState('');

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
    <MarcoAcceso
      clave={paso}
      titulo={paso === 'credenciales' ? 'Ingresar' : 'Verificacion en dos pasos'}
      descripcion={
        paso === 'credenciales'
          ? 'Ingresa con tu correo institucional.'
          : 'Escribe el codigo de tu aplicacion de autenticacion.'
      }
      pie={
        paso === 'credenciales' ? (
          <Link
            href="/recuperar"
            className="acrilico inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium text-primario shadow-elevacion-4 transition-shadow hover:shadow-elevacion-8"
          >
            <Key16Regular aria-hidden />
            Olvide mi contrasena
          </Link>
        ) : null
      }
    >
      {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

      {paso === 'credenciales' ? (
        <form onSubmit={enviarCredenciales} className="space-y-5" noValidate>
          <Campo id="correo" etiqueta="Correo institucional" requerido error={campos['correo']?.[0]}>
            {(props) => (
              <Entrada {...props} name="correo" type="email" autoComplete="username" autoFocus />
            )}
          </Campo>

          <Campo id="contrasena" etiqueta="Contrasena" requerido error={campos['contrasena']?.[0]}>
            {(props) => (
              <Entrada {...props} name="contrasena" type="password" autoComplete="current-password" />
            )}
          </Campo>

          <Boton type="submit" tamano="lg" className="group w-full" cargando={enviando}>
            Ingresar
            {!enviando ? (
              <ArrowRight16Regular
                className="transition-transform duration-normal ease-fluent-decelerate group-hover:translate-x-1"
                aria-hidden
              />
            ) : null}
          </Boton>
        </form>
      ) : (
        <form onSubmit={enviarCodigo} className="space-y-5" noValidate>
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
                autoFocus
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
              />
            )}
          </Campo>

          {/* Progreso del codigo: seis puntos que se encienden al escribir. */}
          <div className="flex justify-center gap-2" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 w-6 rounded-full transition-all duration-normal ease-fluent-decelerate',
                  i < codigo.length ? 'scale-100 bg-primario' : 'scale-75 bg-texto/15',
                )}
              />
            ))}
          </div>

          <Boton type="submit" tamano="lg" className="w-full" cargando={enviando}>
            Verificar
          </Boton>

          <Boton
            type="button"
            variante="texto"
            className="w-full"
            onClick={() => {
              setPaso('credenciales');
              setDesafio('');
              setCodigo('');
              setError(null);
            }}
          >
            <ArrowLeft16Regular aria-hidden />
            Usar otra cuenta
          </Boton>
        </form>
      )}
    </MarcoAcceso>
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
