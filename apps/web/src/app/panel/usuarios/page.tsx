'use client';

import { People24Regular } from '@fluentui/react-icons';
import * as React from 'react';
import {
  Boton,
  Campo,
  Entrada,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Insignia,
  Panel,
  AreaTexto,
  Tabla,
  Td,
  Th,
  EncabezadoPagina,
} from '@/componentes/ui';
import { api, ErrorDeApi } from '@/lib/api';
import { useRecurso } from '@/lib/use-recurso';
import { fecha } from '@/lib/utilidades';

interface UsuarioAdmin {
  readonly id: string;
  readonly correo: string;
  readonly activo: boolean;
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
  const [asignandoA, setAsignandoA] = React.useState<string | null>(null);

  return (
    <>
      <EncabezadoPagina
        icono={People24Regular}
        titulo="Usuarios"
        descripcion="Toda alta, cambio y revocacion queda en la bitacora con autor, motivo y valores anterior y nuevo."
      />

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
                        {usuario.activo ? (
                          <Insignia tono="exito">Activa</Insignia>
                        ) : (
                          <Insignia tono="peligro">Desactivada</Insignia>
                        )}
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
                          aria-expanded={asignandoA === usuario.id}
                          onClick={() => setAsignandoA(asignandoA === usuario.id ? null : usuario.id)}
                        >
                          Roles
                        </Boton>
                      </Td>
                    </tr>

                    {asignandoA === usuario.id ? (
                      <tr>
                        <Td className="bg-panel/60">
                          <FormularioRol usuario={usuario} alCambiar={usuarios.recargar} />
                        </Td>
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

function FormularioRol({
  usuario,
  alCambiar,
}: {
  readonly usuario: UsuarioAdmin;
  readonly alCambiar: () => void;
}) {
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  async function asignar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setOcupado(true);
    setError(null);
    try {
      await api.post(`/usuarios/${usuario.id}/roles`, {
        rolClave: String(datos.get('rolClave') ?? ''),
        motivo: String(datos.get('motivo') ?? ''),
        hastaEl: null,
      });
      alCambiar();
      (evento.target as HTMLFormElement).reset();
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
    } finally {
      setOcupado(false);
    }
  }

  async function revocar(asignacionId: string) {
    const motivo = window.prompt('Motivo de la revocacion (minimo 10 caracteres):');
    if (!motivo || motivo.trim().length < 10) return;

    setOcupado(true);
    setError(null);
    try {
      await api.patch(`/usuarios/roles/${asignacionId}/revocar`, { motivo });
      alCambiar();
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4 py-2">
      {usuario.roles.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-tenue">
            Asignaciones vigentes
          </h3>
          <ul className="mt-2 space-y-1">
            {usuario.roles.map((rol) => (
              <li key={rol.asignacionId} className="flex items-center gap-3 text-xs">
                <span className="font-mono">{rol.clave}</span>
                <span className="text-tenue">desde {fecha(rol.desdeEl)}</span>
                <Boton
                  variante="peligro"
                  tamano="sm"
                  cargando={ocupado}
                  onClick={() => void revocar(rol.asignacionId)}
                >
                  Revocar
                </Boton>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={asignar} className="max-w-md space-y-3 border-t border-borde pt-3">
        <Campo
          id={`rol-${usuario.id}`}
          etiqueta="Rol a asignar"
          ayuda="estudiante · profesor · jefe-carrera · administrador"
          requerido
        >
          {(props) => <Entrada {...props} name="rolClave" className="font-mono text-xs" />}
        </Campo>

        <Campo
          id={`motivo-rol-${usuario.id}`}
          etiqueta="Motivo"
          ayuda="Queda en la bitacora. Minimo 10 caracteres."
          requerido
        >
          {(props) => <AreaTexto {...props} name="motivo" rows={2} />}
        </Campo>

        {error ? (
          <EstadoError mensaje={error.message} correlationId={error.correlationId} />
        ) : null}

        <p className="text-xs text-tenue">
          El sistema rechaza combinaciones que rompan la separacion de funciones, evaluadas sobre
          los permisos acumulados de la cuenta.
        </p>

        <Boton type="submit" tamano="sm" cargando={ocupado}>
          Asignar rol
        </Boton>
      </form>
    </div>
  );
}
