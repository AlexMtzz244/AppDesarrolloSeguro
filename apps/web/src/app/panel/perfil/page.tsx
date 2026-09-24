'use client';

import { Person24Regular } from '@fluentui/react-icons';
import * as React from 'react';
import type { SesionActiva } from '@securecampus/contracts';
import { useSesion } from '@/componentes/sesion';
import {
  Boton,
  Campo,
  Entrada,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Insignia,
  Panel,
  Tabla,
  Td,
  Th,
  EncabezadoPagina,
} from '@/componentes/ui';
import { api, ErrorDeApi } from '@/lib/api';
import { useRecurso } from '@/lib/use-recurso';
import { fecha } from '@/lib/utilidades';

interface PerfilPropio {
  readonly id: string;
  readonly correo: string;
  readonly nombre: string;
  readonly apellidoPaterno: string;
  readonly apellidoMaterno: string | null;
  readonly matricula: string | null;
  readonly telefono: string | null;
  readonly programa: { clave: string; nombre: string } | null;
  readonly miembroDesde: string;
}

export default function PaginaPerfil() {
  const { actor, refrescar } = useSesion();

  // Se pide con `me`, no con el identificador: el cliente no tiene por que
  // conocer su propio ID para pedir lo suyo, y la ruta con identificador
  // ajeno devolveria 403 igualmente.
  const perfil = useRecurso<PerfilPropio>('/perfiles/me');
  const sesiones = useRecurso<SesionActiva[]>('/auth/sesiones');

  return (
    <>
      <EncabezadoPagina
        icono={Person24Regular}
        titulo="Mi perfil"
        descripcion="Tus datos, tu segundo factor y tus sesiones activas."
      />

      <SeccionDatos estado={perfil} />
      <SeccionMfa mfaActivo={actor?.mfaActivo ?? false} alCambiar={refrescar} />
      <SeccionContrasena />
      <SeccionSesiones estado={sesiones} />
    </>
  );
}

// --- Datos del perfil ------------------------------------------------------

function SeccionDatos({ estado }: { readonly estado: ReturnType<typeof useRecurso<PerfilPropio>> }) {
  const [telefono, setTelefono] = React.useState('');
  const [guardando, setGuardando] = React.useState(false);
  const [mensaje, setMensaje] = React.useState<string | null>(null);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  React.useEffect(() => {
    if (estado.datos) setTelefono(estado.datos.telefono ?? '');
  }, [estado.datos]);

  if (estado.cargando) return <Panel titulo="Datos"><EstadoCargando /></Panel>;
  if (estado.error) {
    return (
      <Panel titulo="Datos">
        <EstadoError
          mensaje={estado.error.message}
          correlationId={estado.error.correlationId}
          onReintentar={estado.recargar}
        />
      </Panel>
    );
  }
  if (!estado.datos) return null;

  const perfil = estado.datos;

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setMensaje(null);
    setError(null);
    try {
      await api.patch(`/perfiles/${perfil.id}`, { telefono: telefono.trim() || null });
      setMensaje('Cambios guardados.');
      estado.recargar();
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Panel
      titulo="Datos"
      descripcion="Los campos editables los define la institucion. Nombre y matricula no se modifican desde aqui."
    >
      <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
        <Dato etiqueta="Nombre" valor={`${perfil.nombre} ${perfil.apellidoPaterno} ${perfil.apellidoMaterno ?? ''}`.trim()} />
        <Dato etiqueta="Correo" valor={perfil.correo} />
        <Dato etiqueta="Matricula" valor={perfil.matricula ?? '—'} />
        <Dato etiqueta="Programa" valor={perfil.programa ? `${perfil.programa.clave} — ${perfil.programa.nombre}` : '—'} />
        <Dato etiqueta="Miembro desde" valor={fecha(perfil.miembroDesde)} />
      </dl>

      <form onSubmit={guardar} className="max-w-sm space-y-3">
        <Campo id="telefono" etiqueta="Telefono de contacto">
          {(props) => (
            <Entrada
              {...props}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              autoComplete="tel"
            />
          )}
        </Campo>

        {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
        {mensaje ? (
          <p role="status" className="text-xs font-medium text-exito">
            {mensaje}
          </p>
        ) : null}

        <Boton type="submit" tamano="sm" cargando={guardando}>
          Guardar
        </Boton>
      </form>
    </Panel>
  );
}

function Dato({ etiqueta, valor }: { readonly etiqueta: string; readonly valor: string }) {
  return (
    <div>
      <dt className="text-xs text-tenue">{etiqueta}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

// --- Segundo factor --------------------------------------------------------

interface AltaMfa {
  readonly secreto: string;
  readonly uriOtpauth: string;
}

function SeccionMfa({
  mfaActivo,
  alCambiar,
}: {
  readonly mfaActivo: boolean;
  readonly alCambiar: () => Promise<void>;
}) {
  const [alta, setAlta] = React.useState<AltaMfa | null>(null);
  const [codigos, setCodigos] = React.useState<string[] | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  async function iniciar() {
    setOcupado(true);
    setError(null);
    try {
      setAlta(await api.post<AltaMfa>('/auth/mfa/iniciar'));
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const codigo = String(new FormData(evento.currentTarget).get('codigo') ?? '');
    setOcupado(true);
    setError(null);
    try {
      const respuesta = await api.post<{ activado: boolean; codigosRecuperacion: string[] }>(
        '/auth/mfa/confirmar',
        { codigo },
      );
      if (respuesta.activado) {
        setCodigos(respuesta.codigosRecuperacion);
        setAlta(null);
        await alCambiar();
      } else {
        setError(new ErrorDeApi(400, 'CODIGO_INVALIDO', 'El codigo no es valido. Intenta de nuevo.', '—'));
      }
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Panel
      titulo="Segundo factor"
      descripcion="Corta el robo de cuentas incluso cuando la contrasena ya esta filtrada."
      acciones={mfaActivo ? <Insignia tono="exito">Activo</Insignia> : <Insignia tono="aviso">Sin configurar</Insignia>}
    >
      {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

      {codigos ? (
        <div className="space-y-3" role="status">
          <p className="text-sm font-medium">Segundo factor activado.</p>
          <p className="text-sm text-tenue">
            Guarda estos codigos de recuperacion en un lugar seguro. Se muestran{' '}
            <strong>una sola vez</strong> y cada uno sirve una vez. Son credenciales completas:
            quien los tenga puede entrar sin tu aplicacion.
          </p>
          <ul className="grid grid-cols-2 gap-1.5 font-mono text-sm sm:grid-cols-5">
            {codigos.map((codigo) => (
              <li key={codigo} className="rounded border border-borde bg-panel px-2 py-1 text-center">
                {codigo}
              </li>
            ))}
          </ul>
        </div>
      ) : alta ? (
        <div className="space-y-4">
          <p className="text-sm">
            Registra este secreto en tu aplicacion de autenticacion y confirma con el codigo que
            muestre.
          </p>
          <code className="block break-all rounded bg-panel p-3 font-mono text-xs">
            {alta.secreto}
          </code>
          <form onSubmit={confirmar} className="max-w-xs space-y-3">
            <Campo id="codigo-mfa" etiqueta="Codigo de 6 digitos" requerido>
              {(props) => (
                <Entrada
                  {...props}
                  name="codigo"
                  inputMode="numeric"
                  maxLength={6}
                  className="text-center font-mono tracking-[0.3em]"
                  autoFocus
                />
              )}
            </Campo>
            <Boton type="submit" tamano="sm" cargando={ocupado}>
              Activar
            </Boton>
          </form>
        </div>
      ) : mfaActivo ? (
        <p className="text-sm text-tenue">
          Tu cuenta esta protegida con segundo factor. Para reemplazarlo, vuelve a generarlo: los
          codigos de recuperacion anteriores dejaran de funcionar.
        </p>
      ) : (
        <Boton tamano="sm" onClick={() => void iniciar()} cargando={ocupado}>
          Configurar segundo factor
        </Boton>
      )}
    </Panel>
  );
}

// --- Contrasena ------------------------------------------------------------

function SeccionContrasena() {
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);
  const [confirmando, setConfirmando] = React.useState(false);

  async function cambiar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setOcupado(true);
    setError(null);
    try {
      await api.post('/auth/contrasena/cambiar', {
        contrasenaActual: String(datos.get('actual') ?? ''),
        contrasenaNueva: String(datos.get('nueva') ?? ''),
      });
      // El servidor revoco todas las sesiones, incluida esta. Recargar lleva
      // al login, que es el comportamiento correcto y esperado.
      window.location.href = '/ingresar';
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
      setOcupado(false);
    }
  }

  return (
    <Panel
      titulo="Cambiar contrasena"
      descripcion="Al cambiarla se cierran TODAS tus sesiones activas, incluida esta."
    >
      <form onSubmit={cambiar} className="max-w-sm space-y-3">
        <Campo id="actual" etiqueta="Contrasena actual" requerido>
          {(props) => <Entrada {...props} name="actual" type="password" autoComplete="current-password" />}
        </Campo>

        <Campo
          id="nueva"
          etiqueta="Contrasena nueva"
          ayuda="Minimo 12 caracteres."
          requerido
        >
          {(props) => <Entrada {...props} name="nueva" type="password" autoComplete="new-password" />}
        </Campo>

        {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

        {/* Confirmacion explicita: la accion tiene un efecto que el usuario
            podria no esperar (RNFS-062). */}
        {confirmando ? (
          <div className="space-y-2 rounded-md border border-aviso/40 bg-aviso/5 p-3">
            <p className="text-xs">
              Se cerrara tu sesion en este y en todos los demas dispositivos. Tendras que volver a
              ingresar.
            </p>
            <div className="flex gap-2">
              <Boton type="submit" tamano="sm" cargando={ocupado}>
                Si, cambiar y cerrar sesiones
              </Boton>
              <Boton type="button" variante="contorno" tamano="sm" onClick={() => setConfirmando(false)}>
                Cancelar
              </Boton>
            </div>
          </div>
        ) : (
          <Boton type="button" tamano="sm" onClick={() => setConfirmando(true)}>
            Cambiar contrasena
          </Boton>
        )}
      </form>
    </Panel>
  );
}

// --- Sesiones --------------------------------------------------------------

function SeccionSesiones({ estado }: { readonly estado: ReturnType<typeof useRecurso<SesionActiva[]>> }) {
  const [revocando, setRevocando] = React.useState<string | null>(null);

  async function revocar(id: string) {
    setRevocando(id);
    try {
      await api.delete(`/auth/sesiones/${id}`);
      estado.recargar();
    } finally {
      setRevocando(null);
    }
  }

  return (
    <Panel
      titulo="Sesiones activas"
      descripcion="Si no reconoces alguna, revocala y cambia tu contrasena de inmediato."
    >
      {estado.cargando ? (
        <EstadoCargando />
      ) : estado.error ? (
        <EstadoError
          mensaje={estado.error.message}
          correlationId={estado.error.correlationId}
          onReintentar={estado.recargar}
        />
      ) : !estado.datos?.length ? (
        <EstadoVacio mensaje="No hay sesiones activas." />
      ) : (
        <Tabla resumen="Sesiones activas de tu cuenta">
          <thead>
            <tr>
              <Th>Ultima actividad</Th>
              <Th>Origen</Th>
              <Th>Navegador</Th>
              <Th>Accion</Th>
            </tr>
          </thead>
          <tbody>
            {estado.datos.map((sesion) => (
              <tr key={sesion.id}>
                <Td>
                  {fecha(sesion.ultimaActividadEl)}
                  {sesion.esLaActual ? (
                    <Insignia tono="exito">
                      <span className="ml-0">Esta sesion</span>
                    </Insignia>
                  ) : null}
                </Td>
                <Td className="font-mono text-xs">{sesion.ip ?? '—'}</Td>
                <Td className="max-w-[16rem] truncate text-xs text-tenue" >
                  {sesion.userAgent ?? '—'}
                </Td>
                <Td>
                  {sesion.esLaActual ? (
                    <span className="text-xs text-tenue">—</span>
                  ) : (
                    <Boton
                      variante="peligro"
                      tamano="sm"
                      cargando={revocando === sesion.id}
                      onClick={() => void revocar(sesion.id)}
                    >
                      Revocar
                    </Boton>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </Panel>
  );
}
