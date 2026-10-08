'use client';

import * as React from 'react';
import {
  AreaTexto,
  BarraMensaje,
  Boton,
  Campo,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Insignia,
  Selector,
} from '@/componentes/ui';
import { aErrorDeApi, api, type ErrorDeApi } from '@/lib/api';
import { useRecurso } from '@/lib/use-recurso';
import { fecha } from '@/lib/utilidades';
import type { Grupo, Persona } from './tipos';

interface VersionAsignacion {
  readonly id: string;
  readonly version: number;
  readonly desdeEl: string;
  readonly hastaEl: string | null;
  readonly vigente: boolean;
  readonly motivo: string;
  readonly profesor: { idPublico: string; correo: string };
  readonly autor: { idPublico: string; correo: string };
}

const titulo = 'text-xs font-semibold uppercase tracking-wide text-tenue';

/**
 * Asignacion docente (RF-030, RF-031).
 *
 * Muestra TODAS las versiones, incluidas las cerradas: el ataque del escenario
 * 5 de SC-LAB-001 termina en un estado final consistente —el jefe se asigna,
 * califica y revierte— y lo unico que lo delata es la version intermedia.
 */
export function GestionAsignacion({ grupo, alCambiar }: { readonly grupo: Grupo; readonly alCambiar: () => void }) {
  const historial = useRecurso<VersionAsignacion[]>(`/grupos/${grupo.id}/asignaciones`);
  const profesores = useRecurso<Persona[]>('/profesores');
  const [modo, setModo] = React.useState<'asignar' | 'cerrar'>('asignar');
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);
  const abierto = grupo.periodo.estado === 'abierto';
  const vigente = historial.datos?.find((v) => v.vigente) ?? null;

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const motivo = String(datos.get('motivo') ?? '');
    setEnviando(true);
    setError(null);
    try {
      if (modo === 'asignar') {
        await api.post(`/grupos/${grupo.id}/asignaciones`, {
          grupoId: grupo.id,
          profesorId: String(datos.get('profesorId') ?? ''),
          desde: new Date().toISOString(),
          hasta: null,
          motivo,
        });
      } else {
        await api.post(`/grupos/${grupo.id}/asignaciones/cerrar`, { motivo });
      }
      formulario.reset();
      setModo('asignar');
      historial.recargar();
      alCambiar();
    } catch (e) {
      setError(aErrorDeApi(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="Asignacion docente">
      <div>
        <h3 className={titulo}>Historial de asignaciones</h3>
        {historial.cargando ? (
          <EstadoCargando />
        ) : historial.error ? (
          <EstadoError mensaje={historial.error.message} onReintentar={historial.recargar} />
        ) : !historial.datos?.length ? (
          <EstadoVacio mensaje="Este grupo nunca ha tenido profesor asignado." />
        ) : (
          <ol className="mt-2 space-y-2">
            {historial.datos.map((version) => (
              <li key={version.id} className="rounded border border-borde bg-fondo p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">v{version.version}</span>
                  <span className="font-medium">{version.profesor.correo}</span>
                  {version.vigente ? <Insignia tono="exito">Vigente</Insignia> : <Insignia tono="neutro">Cerrada</Insignia>}
                </div>
                <p className="mt-1 text-tenue">
                  {fecha(version.desdeEl)} → {version.hastaEl ? fecha(version.hastaEl) : 'sin fin'}
                </p>
                <p className="mt-1">
                  <span className="text-tenue">Motivo:</span> {version.motivo}
                </p>
                <p className="text-tenue">Registrado por {version.autor.correo}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {!abierto ? (
        <BarraMensaje tono="aviso">El periodo esta cerrado: la asignacion ya no se modifica.</BarraMensaje>
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="space-y-3 border-t border-borde pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={titulo}>{modo === 'asignar' ? 'Asignar profesor' : 'Cerrar asignacion vigente'}</h3>
            {vigente ? (
              <Boton
                type="button"
                variante="texto"
                tamano="sm"
                onClick={() => setModo(modo === 'asignar' ? 'cerrar' : 'asignar')}
              >
                {modo === 'asignar' ? 'o dejar el grupo sin profesor' : 'o asignar otro profesor'}
              </Boton>
            ) : null}
          </div>

          {modo === 'asignar' ? (
            profesores.cargando ? (
              <EstadoCargando etiqueta="Cargando profesores" />
            ) : profesores.error ? (
              <EstadoError mensaje={profesores.error.message} onReintentar={profesores.recargar} />
            ) : !profesores.datos?.length ? (
              <BarraMensaje tono="aviso">No hay profesores activos en tu programa.</BarraMensaje>
            ) : (
              <Campo
                id={`profesor-${grupo.id}`}
                etiqueta="Profesor"
                ayuda={vigente ? 'La asignacion actual se cierra; no se sobrescribe.' : undefined}
                requerido
              >
                {(props) => (
                  <Selector {...props} name="profesorId" required defaultValue="">
                    <option value="" disabled>
                      Selecciona un profesor
                    </option>
                    {profesores.datos!.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.id === vigente?.profesor.idPublico}>
                        {p.nombre} · {p.correo}
                        {p.id === vigente?.profesor.idPublico ? ' (actual)' : ''}
                      </option>
                    ))}
                  </Selector>
                )}
              </Campo>
            )
          ) : (
            <BarraMensaje tono="aviso">
              {vigente?.profesor.correo} dejara de poder capturar en este grupo de inmediato.
            </BarraMensaje>
          )}

          <Campo id={`motivo-asig-${grupo.id}`} etiqueta="Motivo" ayuda="Queda en la bitacora. Minimo 10 caracteres." requerido>
            {(props) => <AreaTexto {...props} name="motivo" rows={2} required minLength={10} />}
          </Campo>

          {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

          <Boton type="submit" tamano="sm" variante={modo === 'cerrar' ? 'peligro' : 'primario'} cargando={enviando}>
            {modo === 'asignar' ? 'Registrar asignacion' : 'Cerrar asignacion'}
          </Boton>
        </form>
      )}
    </section>
  );
}
