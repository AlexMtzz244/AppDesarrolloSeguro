'use client';

import Link from 'next/link';
import { useSesion } from '@/componentes/sesion';
import { Insignia, Panel } from '@/componentes/ui';

/**
 * Inicio del area autenticada.
 *
 * Muestra la identidad efectiva del actor tal como la calculo el SERVIDOR,
 * incluidos sus permisos. Exponerlos no es una fuga: son los permisos de quien
 * esta mirando, y verlos ayuda a entender por que una opcion aparece o no.
 * Lo que no hace esta pantalla es usarlos para decidir nada.
 */
export default function PaginaInicioPanel() {
  const { actor } = useSesion();
  if (!actor) return null;

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Hola, {actor.nombre}</h1>
        <p className="text-sm text-tenue">{actor.correo}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel titulo="Tu acceso" descripcion="Calculado por el servidor en cada peticion.">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-tenue">Roles</dt>
              <dd className="flex flex-wrap justify-end gap-1">
                {actor.roles.map((rol) => (
                  <Insignia key={rol}>{rol}</Insignia>
                ))}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-tenue">Segundo factor</dt>
              <dd>
                {actor.mfaActivo ? (
                  <Insignia tono="exito">Activo</Insignia>
                ) : actor.mfaObligatorio ? (
                  <Insignia tono="peligro">Obligatorio, sin configurar</Insignia>
                ) : (
                  <Insignia tono="aviso">Opcional, sin configurar</Insignia>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-tenue">Permisos vigentes</dt>
              <dd className="font-mono text-xs">{actor.permisos.length}</dd>
            </div>
          </dl>
        </Panel>

        <Panel titulo="Seguridad de tu cuenta">
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/panel/perfil" className="text-primario underline-offset-4 hover:underline">
                Revisar sesiones activas
              </Link>
              <p className="text-xs text-tenue">
                Si ves una que no reconoces, revocala y cambia tu contrasena.
              </p>
            </li>
            <li>
              <Link href="/panel/perfil" className="text-primario underline-offset-4 hover:underline">
                Cambiar contrasena
              </Link>
              <p className="text-xs text-tenue">
                Cambiarla cierra todas tus sesiones, incluida esta.
              </p>
            </li>
          </ul>
        </Panel>
      </div>

      <Panel titulo="Tus permisos" descripcion="Lo que la interfaz muestra se deriva de esta lista; lo que puedes hacer lo decide el servidor.">
        <ul className="flex flex-wrap gap-1.5">
          {[...actor.permisos].sort().map((permiso) => (
            <li key={permiso}>
              <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-xs">{permiso}</code>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
