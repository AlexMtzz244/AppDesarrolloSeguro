'use client';

import { PersonAdd16Regular, PersonDelete16Regular } from '@fluentui/react-icons';
import * as React from 'react';
import {
  AreaTexto,
  BarraMensaje,
  Boton,
  Campo,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Selector,
} from '@/componentes/ui';
import { aErrorDeApi, api, type ErrorDeApi } from '@/lib/api';
import { useRecurso } from '@/lib/use-recurso';
import type { Grupo, Persona } from './tipos';

interface Inscripcion {
  readonly id: string;
  readonly creadaEl: string;
  readonly estudiante: Persona;
}

const titulo = 'text-xs font-semibold uppercase tracking-wide text-tenue';

/**
 * Inscripciones del grupo. Sin esto un grupo nuevo nunca tendria alumnos y el
 * profesor asignado no tendria a quien calificar.
 *
 * El listado de candidatos lo filtra el servidor por el programa del jefe; un
 * estudiante de otra carrera recibe 403 aunque alguien edite el `<select>`.
 */
export function GestionInscripciones({ grupo, alCambiar }: { readonly grupo: Grupo; readonly alCambiar: () => void }) {
  const inscritos = useRecurso<Inscripcion[]>(`/grupos/${grupo.id}/inscripciones`);
  const abierto = grupo.periodo.estado === 'abierto';
  const candidatos = useRecurso<Persona[]>(abierto ? '/estudiantes' : null);
  const [dandoDeBaja, setDandoDeBaja] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  const yaInscritos = new Set(inscritos.datos?.map((i) => i.estudiante.id));
  const disponibles = candidatos.datos?.filter((c) => !yaInscritos.has(c.id)) ?? [];
  const lleno = (inscritos.datos?.length ?? 0) >= grupo.cupo;

  async function operar(operacion: () => Promise<unknown>, formulario?: HTMLFormElement) {
    setEnviando(true);
    setError(null);
    try {
      await operacion();
      formulario?.reset();
      setDandoDeBaja(null);
      inscritos.recargar();
      alCambiar();
    } catch (e) {
      setError(aErrorDeApi(e));
    } finally {
      setEnviando(false);
    }
  }

  function inscribir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const estudianteId = String(new FormData(formulario).get('estudianteId') ?? '');
    void operar(() => api.post(`/grupos/${grupo.id}/inscripciones`, { estudianteId }), formulario);
  }

  function darDeBaja(evento: React.FormEvent<HTMLFormElement>, inscripcionId: string) {
    evento.preventDefault();
    const motivo = String(new FormData(evento.currentTarget).get('motivo') ?? '');
    void operar(() => api.post(`/grupos/${grupo.id}/inscripciones/${inscripcionId}/baja`, { motivo }));
  }

  return (
    <section className="space-y-4" aria-label="Inscripciones">
      <div>
        <h3 className={titulo}>
          Inscritos ({inscritos.datos?.length ?? 0}/{grupo.cupo})
        </h3>
        {inscritos.cargando ? (
          <EstadoCargando />
        ) : inscritos.error ? (
          <EstadoError mensaje={inscritos.error.message} onReintentar={inscritos.recargar} />
        ) : !inscritos.datos?.length ? (
          <EstadoVacio mensaje="Nadie esta inscrito en este grupo." />
        ) : (
          <ul className="mt-2 divide-y divide-borde/60 rounded border border-borde bg-fondo">
            {inscritos.datos.map((i) => (
              <li key={i.id} className="space-y-2 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    <span className="font-mono text-tenue">{i.estudiante.matricula ?? '—'}</span>{' '}
                    <span className="font-medium">{i.estudiante.nombre}</span>
                  </span>
                  {abierto ? (
                    <Boton
                      variante="tenue"
                      tamano="sm"
                      aria-expanded={dandoDeBaja === i.id}
                      onClick={() => setDandoDeBaja(dandoDeBaja === i.id ? null : i.id)}
                    >
                      <PersonDelete16Regular aria-hidden />
                      {dandoDeBaja === i.id ? 'Cancelar' : 'Baja'}
                    </Boton>
                  ) : null}
                </div>
                {dandoDeBaja === i.id ? (
                  <form onSubmit={(e) => darDeBaja(e, i.id)} className="space-y-2">
                    <Campo id={`baja-${i.id}`} etiqueta="Motivo de la baja" ayuda="Minimo 10 caracteres." requerido>
                      {(props) => <AreaTexto {...props} name="motivo" rows={2} required minLength={10} />}
                    </Campo>
                    <Boton type="submit" tamano="sm" variante="peligro" cargando={enviando}>
                      Dar de baja
                    </Boton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!abierto ? (
        <BarraMensaje tono="aviso">El periodo esta cerrado: las inscripciones ya no cambian.</BarraMensaje>
      ) : (
        <form onSubmit={inscribir} className="space-y-3 border-t border-borde pt-3">
          <h3 className={titulo}>Inscribir estudiante</h3>
          {lleno ? (
            <BarraMensaje tono="aviso">El grupo alcanzo su cupo.</BarraMensaje>
          ) : candidatos.cargando ? (
            <EstadoCargando etiqueta="Cargando estudiantes" />
          ) : candidatos.error ? (
            <EstadoError mensaje={candidatos.error.message} onReintentar={candidatos.recargar} />
          ) : !disponibles.length ? (
            <BarraMensaje>Todos los estudiantes activos de tu programa ya estan inscritos.</BarraMensaje>
          ) : (
            <>
              <Campo id={`estudiante-${grupo.id}`} etiqueta="Estudiante" requerido>
                {(props) => (
                  <Selector {...props} name="estudianteId" required defaultValue="">
                    <option value="" disabled>
                      Selecciona un estudiante
                    </option>
                    {disponibles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.matricula ?? '—'} · {c.nombre}
                      </option>
                    ))}
                  </Selector>
                )}
              </Campo>
              <Boton type="submit" tamano="sm" cargando={enviando}>
                <PersonAdd16Regular aria-hidden />
                Inscribir
              </Boton>
            </>
          )}
        </form>
      )}

      {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
    </section>
  );
}
