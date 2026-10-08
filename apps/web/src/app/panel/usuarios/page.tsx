'use client';

import { LockOpen16Regular, People24Regular, PersonAdd16Regular } from '@fluentui/react-icons';
import * as React from 'react';
import { ROLES_BASE } from '@securecampus/contracts';
import {
  AreaTexto,
  BarraMensaje,
  Boton,
  Campo,
  EncabezadoPagina,
  Entrada,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Insignia,
  Panel,
  Selector,
  Tabla,
  Td,
  Th,
} from '@/componentes/ui';
import { aErrorDeApi, api, type ErrorDeApi } from '@/lib/api';
import { useRecurso } from '@/lib/use-recurso';
import { fecha } from '@/lib/utilidades';

interface UsuarioAdmin {
  readonly id: string;
  readonly correo: string;
  readonly activo: boolean;
  readonly bloqueadoPorIntentos: boolean;
  readonly nombre: string | null;
  readonly matricula: string | null;
  readonly creadoEl: string;
  readonly roles: {
    asignacionId: string;
    clave: string;
    nombre: string;
    desdeEl: string;
    hastaEl: string | null;
  }[];
}

interface Pagina {
  readonly datos: UsuarioAdmin[];
  readonly pagina: number;
  readonly tamano: number;
  readonly total: number;
}

const titulo = 'text-xs font-semibold uppercase tracking-wide text-tenue';

/**
 * Administracion de usuarios y roles (RF-013, RF-014, RF-071).
 *
 * Cada operacion de esta pantalla exige motivo y segundo factor verificado.
 * Que la interfaz los pida no es lo que los hace obligatorios: el servidor
 * rechaza la peticion sin ellos. Aqui solo se evita que el usuario descubra el
 * requisito por un 400.
 */
export default function PaginaUsuarios() {
  const [pagina, setPagina] = React.useState(1);
  const usuarios = useRecurso<Pagina>(`/usuarios?pagina=${pagina}&tamano=25`, [pagina]);
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const [creando, setCreando] = React.useState(false);

  return (
    <>
      <EncabezadoPagina
        icono={People24Regular}
        titulo="Usuarios"
        descripcion="Toda alta, cambio y revocacion queda en la bitacora con autor, motivo y valores anterior y nuevo."
        acciones={
          <Boton onClick={() => setCreando((v) => !v)} aria-expanded={creando}>
            <PersonAdd16Regular aria-hidden />
            Nueva cuenta
          </Boton>
        }
      />

      {creando ? (
        <FormularioCuenta
          alTerminar={() => {
            setCreando(false);
            usuarios.recargar();
          }}
        />
      ) : null}

      <Panel titulo="Cuentas" descripcion={usuarios.datos ? `${usuarios.datos.total} en total` : undefined}>
        {usuarios.cargando ? (
          <EstadoCargando />
        ) : usuarios.error ? (
          <EstadoError
            mensaje={usuarios.error.message}
            correlationId={usuarios.error.correlationId}
            onReintentar={usuarios.recargar}
          />
        ) : !usuarios.datos?.datos.length ? (
          <EstadoVacio mensaje="No hay usuarios registrados." />
        ) : (
          <>
            <Tabla resumen="Cuentas de usuario con su estado y roles vigentes">
              <thead>
                <tr>
                  <Th>Correo</Th>
                  <Th>Nombre</Th>
                  <Th>Estado</Th>
                  <Th>Roles vigentes</Th>
                  <Th>Alta</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {usuarios.datos.datos.map((usuario) => (
                  <React.Fragment key={usuario.id}>
                    <tr>
                      <Td className="font-medium">{usuario.correo}</Td>
                      <Td>{usuario.nombre ?? '—'}</Td>
                      <Td>
                        <span className="inline-flex flex-wrap gap-1">
                          {usuario.activo ? (
                            <Insignia tono="exito">Activa</Insignia>
                          ) : (
                            <Insignia tono="peligro">Desactivada</Insignia>
                          )}
                          {usuario.bloqueadoPorIntentos ? (
                            <Insignia tono="peligro">Bloqueada por intentos</Insignia>
                          ) : null}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {usuario.roles.length === 0 ? (
                            <span className="text-xs text-tenue">Sin roles</span>
                          ) : (
                            usuario.roles.map((rol) => (
                              <Insignia key={rol.asignacionId}>
                                {rol.clave}
                                {rol.hastaEl ? ` (hasta ${fecha(rol.hastaEl)})` : ''}
                              </Insignia>
                            ))
                          )}
                        </div>
                      </Td>
                      <Td className="text-xs text-tenue">{fecha(usuario.creadoEl)}</Td>
                      <Td>
                        <Boton
                          variante="contorno"
                          tamano="sm"
                          aria-expanded={abierto === usuario.id}
                          onClick={() => setAbierto(abierto === usuario.id ? null : usuario.id)}
                        >
                          {abierto === usuario.id ? 'Ocultar' : 'Gestionar'}
                        </Boton>
                      </Td>
                    </tr>

                    {abierto === usuario.id ? (
                      <tr>
                        <td colSpan={6} className="border-b border-borde/50 bg-panel/60 px-3 py-4">
                          <div className="grid gap-6 xl:grid-cols-2">
                            <GestionCuenta usuario={usuario} alCambiar={usuarios.recargar} />
                            <FormularioRol usuario={usuario} alCambiar={usuarios.recargar} />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </Tabla>

            <nav className="mt-4 flex items-center justify-between" aria-label="Paginacion">
              <Boton
                variante="contorno"
                tamano="sm"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Boton>
              <span className="text-xs text-tenue">
                Pagina {usuarios.datos.pagina} de{' '}
                {Math.max(1, Math.ceil(usuarios.datos.total / usuarios.datos.tamano))}
              </span>
              <Boton
                variante="contorno"
                tamano="sm"
                disabled={pagina * usuarios.datos.tamano >= usuarios.datos.total}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </Boton>
            </nav>
          </>
        )}
      </Panel>
    </>
  );
}

function useOperacion(alCambiar: () => void) {
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  async function ejecutar(operacion: () => Promise<unknown>, formulario?: HTMLFormElement) {
    setOcupado(true);
    setError(null);
    try {
      await operacion();
      formulario?.reset();
      alCambiar();
      return true;
    } catch (e) {
      setError(aErrorDeApi(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return { ocupado, error, ejecutar };
}

/**
 * Bloqueo manual (desactivar) y desbloqueo por intentos fallidos.
 *
 * Son dos cosas distintas: desactivar corta la cuenta y todas sus sesiones
 * hasta que alguien la reactive; el bloqueo por intentos es automatico y vence
 * solo con la ventana configurada, o antes si el administrador lo levanta.
 */
function GestionCuenta({ usuario, alCambiar }: { readonly usuario: UsuarioAdmin; readonly alCambiar: () => void }) {
  const { ocupado, error, ejecutar } = useOperacion(alCambiar);
  const [accion, setAccion] = React.useState<'estado' | 'desbloquear' | null>(null);

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const motivo = String(new FormData(formulario).get('motivo') ?? '');
    void ejecutar(
      () =>
        accion === 'desbloquear'
          ? api.post(`/usuarios/${usuario.id}/desbloquear`, { motivo })
          : api.patch(`/usuarios/${usuario.id}/estado`, { activo: !usuario.activo, motivo }),
      formulario,
    ).then((ok) => ok && setAccion(null));
  }

  return (
    <section className="space-y-3" aria-label="Estado de la cuenta">
      <h3 className={titulo}>Cuenta</h3>
      <div className="flex flex-wrap gap-2">
        <Boton
          variante={usuario.activo ? 'peligro' : 'primario'}
          tamano="sm"
          aria-pressed={accion === 'estado'}
          onClick={() => setAccion(accion === 'estado' ? null : 'estado')}
        >
          {usuario.activo ? 'Desactivar cuenta' : 'Reactivar cuenta'}
        </Boton>
        {usuario.bloqueadoPorIntentos ? (
          <Boton
            variante="contorno"
            tamano="sm"
            aria-pressed={accion === 'desbloquear'}
            onClick={() => setAccion(accion === 'desbloquear' ? null : 'desbloquear')}
          >
            <LockOpen16Regular aria-hidden />
            Desbloquear
          </Boton>
        ) : null}
      </div>

      {accion ? (
        <form onSubmit={enviar} className="max-w-md space-y-3">
          <BarraMensaje tono="aviso">
            {accion === 'desbloquear'
              ? 'El titular podra volver a intentar entrar de inmediato. Si el bloqueo vino de un ataque, considera desactivar la cuenta en su lugar.'
              : usuario.activo
                ? 'La cuenta no podra entrar y todas sus sesiones abiertas se cierran en este momento.'
                : 'La cuenta podra volver a iniciar sesion con su contrasena actual.'}
          </BarraMensaje>
          <Campo id={`motivo-cuenta-${usuario.id}`} etiqueta="Motivo" ayuda="Minimo 10 caracteres." requerido>
            {(props) => <AreaTexto {...props} name="motivo" rows={2} required minLength={10} />}
          </Campo>
          {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
          <Boton type="submit" tamano="sm" cargando={ocupado}>
            Confirmar
          </Boton>
        </form>
      ) : null}
    </section>
  );
}

function FormularioRol({ usuario, alCambiar }: { readonly usuario: UsuarioAdmin; readonly alCambiar: () => void }) {
  const { ocupado, error, ejecutar } = useOperacion(alCambiar);

  function asignar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    void ejecutar(
      () =>
        api.post(`/usuarios/${usuario.id}/roles`, {
          rolClave: String(datos.get('rolClave') ?? ''),
          motivo: String(datos.get('motivo') ?? ''),
          hastaEl: null,
        }),
      formulario,
    );
  }

  function revocar(asignacionId: string) {
    const motivo = window.prompt('Motivo de la revocacion (minimo 10 caracteres):');
    if (!motivo || motivo.trim().length < 10) return;
    void ejecutar(() => api.patch(`/usuarios/roles/${asignacionId}/revocar`, { motivo }));
  }

  return (
    <section className="space-y-3" aria-label="Roles">
      <h3 className={titulo}>Roles</h3>
      {usuario.roles.length > 0 ? (
        <ul className="space-y-1">
          {usuario.roles.map((rol) => (
            <li key={rol.asignacionId} className="flex items-center gap-3 text-xs">
              <span className="font-mono">{rol.clave}</span>
              <span className="text-tenue">desde {fecha(rol.desdeEl)}</span>
              <Boton variante="peligro" tamano="sm" cargando={ocupado} onClick={() => revocar(rol.asignacionId)}>
                Revocar
              </Boton>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={asignar} className="max-w-md space-y-3 border-t border-borde pt-3">
        <Campo id={`rol-${usuario.id}`} etiqueta="Rol a asignar" requerido>
          {(props) => (
            <Selector {...props} name="rolClave" required>
              {ROLES_BASE.filter((r) => !usuario.roles.some((x) => x.clave === r)).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
        <Campo id={`motivo-rol-${usuario.id}`} etiqueta="Motivo" ayuda="Queda en la bitacora. Minimo 10 caracteres." requerido>
          {(props) => <AreaTexto {...props} name="motivo" rows={2} required minLength={10} />}
        </Campo>
        {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
        <p className="text-xs text-tenue">
          El sistema rechaza combinaciones que rompan la separacion de funciones, evaluadas sobre los permisos
          acumulados de la cuenta.
        </p>
        <Boton type="submit" tamano="sm" cargando={ocupado}>
          Asignar rol
        </Boton>
      </form>
    </section>
  );
}

function FormularioCuenta({ alTerminar }: { readonly alTerminar: () => void }) {
  const { ocupado, error, ejecutar } = useOperacion(alTerminar);

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const opcional = (campo: string) => {
      const valor = String(datos.get(campo) ?? '').trim();
      return valor ? { [campo]: valor } : {};
    };
    void ejecutar(
      () =>
        api.post('/usuarios', {
          correo: String(datos.get('correo') ?? '').trim(),
          nombre: String(datos.get('nombre') ?? '').trim(),
          apellidoPaterno: String(datos.get('apellidoPaterno') ?? '').trim(),
          ...opcional('apellidoMaterno'),
          ...opcional('matricula'),
          ...opcional('programaClave'),
          rolClave: String(datos.get('rolClave') ?? ''),
          contrasenaInicial: String(datos.get('contrasenaInicial') ?? ''),
          motivo: String(datos.get('motivo') ?? ''),
        }),
      formulario,
    );
  }

  return (
    <Panel
      titulo="Nueva cuenta"
      descripcion="La contrasena inicial no se muestra en ningun lado: entregala por un canal seguro o pide al titular que use la recuperacion."
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo id="nueva-correo" etiqueta="Correo institucional" requerido>
            {(props) => <Entrada {...props} name="correo" type="email" required autoComplete="off" />}
          </Campo>
          <Campo id="nueva-nombre" etiqueta="Nombre" requerido>
            {(props) => <Entrada {...props} name="nombre" required />}
          </Campo>
          <Campo id="nueva-paterno" etiqueta="Apellido paterno" requerido>
            {(props) => <Entrada {...props} name="apellidoPaterno" required />}
          </Campo>
          <Campo id="nueva-materno" etiqueta="Apellido materno">
            {(props) => <Entrada {...props} name="apellidoMaterno" />}
          </Campo>
          <Campo id="nueva-rol" etiqueta="Rol inicial" requerido>
            {(props) => (
              <Selector {...props} name="rolClave" required>
                {ROLES_BASE.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Selector>
            )}
          </Campo>
          <Campo id="nueva-programa" etiqueta="Programa" ayuda="Clave, ej. ISC. Requerido para estudiante, profesor y jefe.">
            {(props) => <Entrada {...props} name="programaClave" className="font-mono uppercase" />}
          </Campo>
          <Campo id="nueva-matricula" etiqueta="Matricula" ayuda="Solo estudiantes.">
            {(props) => <Entrada {...props} name="matricula" className="font-mono" />}
          </Campo>
          <Campo id="nueva-contrasena" etiqueta="Contrasena inicial" ayuda="Minimo 12 caracteres." requerido>
            {(props) => (
              <Entrada {...props} name="contrasenaInicial" type="password" required minLength={12} autoComplete="new-password" />
            )}
          </Campo>
        </div>
        <div className="max-w-lg">
          <Campo id="nueva-motivo" etiqueta="Motivo" ayuda="Minimo 10 caracteres." requerido>
            {(props) => <AreaTexto {...props} name="motivo" rows={2} required minLength={10} />}
          </Campo>
        </div>
        {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
        <Boton type="submit" cargando={ocupado}>
          Crear cuenta
        </Boton>
      </form>
    </Panel>
  );
}
