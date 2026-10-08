'use client';

import { History16Regular, Save16Regular, Send16Regular } from '@fluentui/react-icons';
import * as React from 'react';
import {
  BarraMensaje,
  Boton,
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

interface GrupoAsignado {
  readonly id: string;
  readonly clave: string;
  readonly materia: { clave: string; nombre: string };
  readonly periodo: { clave: string; estado: string };
}

interface FilaCaptura {
  readonly estudiante: { id: string; matricula: string | null; nombre: string };
  readonly calificacion: { id: string; valor: number; estado: string; version: number } | null;
}

interface VersionHistorial {
  readonly version: number;
  readonly valorAnterior: number | null;
  readonly valorNuevo: number;
  readonly estadoNuevo: string;
  readonly motivo: string | null;
  readonly creadaEl: string;
}

function editable(fila: FilaCaptura): boolean {
  return !fila.calificacion || fila.calificacion.estado === 'borrador';
}

function valorValido(texto: string): boolean {
  if (texto.trim() === '') return false;
  const n = Number(texto);
  return Number.isFinite(n) && n >= 0 && n <= 100 && Math.round(n * 100) === n * 100;
}

/**
 * Captura y publicacion de calificaciones del profesor (RF-041 a RF-043).
 *
 * La pantalla solo ofrece los grupos con asignacion vigente porque es lo que
 * devuelve la API; si el profesor llegara a otro grupo por URL, la lista de
 * captura responderia 403. Lo publicado aparece bloqueado: la unica salida es
 * la correccion, que es otro permiso y otra cuenta.
 */
export function CapturaProfesor() {
  const grupos = useRecurso<GrupoAsignado[]>('/grupos');
  const [grupoId, setGrupoId] = React.useState<string>('');

  // El grupo puede venir de la seccion Grupos (?grupo=...). Se lee una sola
  // vez y solo se acepta si esta entre los grupos que la API devolvio.
  React.useEffect(() => {
    if (!grupos.datos?.length || grupoId) return;
    const pedido = new URLSearchParams(window.location.search).get('grupo');
    const elegido = grupos.datos.find((g) => g.id === pedido) ?? grupos.datos[0];
    if (elegido) setGrupoId(elegido.id);
  }, [grupos.datos, grupoId]);

  const grupo = grupos.datos?.find((g) => g.id === grupoId) ?? null;

  return (
    <Panel
      titulo="Captura de calificaciones"
      descripcion="Captura en borrador, revisa y publica. Lo publicado ya no se edita aqui."
    >
      {grupos.cargando ? (
        <EstadoCargando etiqueta="Cargando tus grupos" />
      ) : grupos.error ? (
        <EstadoError
          mensaje={grupos.error.message}
          correlationId={grupos.error.correlationId}
          onReintentar={grupos.recargar}
        />
      ) : !grupos.datos?.length ? (
        <EstadoVacio mensaje="No tienes grupos con asignacion vigente. La asignacion la registra tu jefe de carrera." />
      ) : (
        <div className="space-y-5">
          <div className="max-w-md space-y-1.5">
            <label htmlFor="grupo-captura" className="text-sm font-semibold">
              Grupo
            </label>
            <Selector id="grupo-captura" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
              {grupos.datos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.clave} · {g.materia.nombre} · {g.periodo.clave}
                </option>
              ))}
            </Selector>
          </div>

          {grupo ? <ListaCaptura key={grupo.id} grupo={grupo} /> : null}
        </div>
      )}
    </Panel>
  );
}

function ListaCaptura({ grupo }: { readonly grupo: GrupoAsignado }) {
  const lista = useRecurso<FilaCaptura[]>(
    grupo.periodo.estado === 'abierto' ? `/calificaciones/grupo/${grupo.id}` : null,
  );
  const [valores, setValores] = React.useState<Record<string, string>>({});
  const [seleccion, setSeleccion] = React.useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = React.useState(false);
  const [ocupado, setOcupado] = React.useState<'guardar' | 'publicar' | null>(null);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [historialDe, setHistorialDe] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!lista.datos) return;
    const iniciales: Record<string, string> = {};
    for (const fila of lista.datos) {
      iniciales[fila.estudiante.id] = fila.calificacion ? String(fila.calificacion.valor) : '';
    }
    setValores(iniciales);
    setSeleccion(new Set());
    setConfirmando(false);
  }, [lista.datos]);

  if (grupo.periodo.estado !== 'abierto') {
    return (
      <BarraMensaje tono="aviso">
        El periodo {grupo.periodo.clave} esta cerrado: ya no se captura ni se publica en este grupo.
      </BarraMensaje>
    );
  }

  if (lista.cargando) return <EstadoCargando etiqueta="Cargando lista de captura" />;
  if (lista.error) {
    return (
      <EstadoError mensaje={lista.error.message} correlationId={lista.error.correlationId} onReintentar={lista.recargar} />
    );
  }
  if (!lista.datos?.length) {
    return <EstadoVacio mensaje="Este grupo no tiene estudiantes inscritos." />;
  }

  const filas = lista.datos;
  const cambios = filas.filter((f) => {
    if (!editable(f)) return false;
    const actual = valores[f.estudiante.id] ?? '';
    const original = f.calificacion ? String(f.calificacion.valor) : '';
    return actual.trim() !== '' && actual !== original;
  });
  const invalidos = cambios.filter((f) => !valorValido(valores[f.estudiante.id] ?? ''));
  const borradores = filas.filter((f) => f.calificacion?.estado === 'borrador');
  const hayCambiosSinGuardar = cambios.length > 0;

  async function guardar() {
    setOcupado('guardar');
    setError(null);
    setAviso(null);
    try {
      const r = await api.post<{ capturadas: number }>('/calificaciones/captura', {
        grupoId: grupo.id,
        calificaciones: cambios.map((f) => ({
          estudianteId: f.estudiante.id,
          valor: Number(valores[f.estudiante.id]),
        })),
      });
      setAviso(`${r.capturadas} calificacion(es) guardada(s) en borrador.`);
      lista.recargar();
    } catch (e) {
      setError(aErrorDeApi(e));
    } finally {
      setOcupado(null);
    }
  }

  async function publicar() {
    setOcupado('publicar');
    setError(null);
    setAviso(null);
    try {
      const ids = borradores.filter((f) => seleccion.has(f.calificacion!.id)).map((f) => f.calificacion!.id);
      const r = await api.post<{ publicadas: number }>('/calificaciones/publicar', {
        grupoId: grupo.id,
        calificacionIds: ids,
      });
      setAviso(`${r.publicadas} calificacion(es) publicada(s). Los estudiantes ya pueden verlas.`);
      lista.recargar();
    } catch (e) {
      setError(aErrorDeApi(e));
    } finally {
      setOcupado(null);
      setConfirmando(false);
    }
  }

  function alternar(id: string) {
    setSeleccion((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
    setConfirmando(false);
  }

  const todosSeleccionados = borradores.length > 0 && borradores.every((f) => seleccion.has(f.calificacion!.id));

  return (
    <div className="space-y-4">
      <Tabla resumen={`Lista de captura del grupo ${grupo.clave}`}>
        <thead>
          <tr>
            <Th>
              <input
                type="checkbox"
                aria-label="Seleccionar todos los borradores"
                disabled={!borradores.length}
                checked={todosSeleccionados}
                onChange={() =>
                  setSeleccion(todosSeleccionados ? new Set() : new Set(borradores.map((f) => f.calificacion!.id)))
                }
              />
            </Th>
            <Th>Matricula</Th>
            <Th>Estudiante</Th>
            <Th>Calificacion (0–100)</Th>
            <Th>Estado</Th>
            <Th>Historial</Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const id = fila.estudiante.id;
            const texto = valores[id] ?? '';
            const invalido = editable(fila) && texto.trim() !== '' && !valorValido(texto);
            return (
              <React.Fragment key={id}>
                <tr>
                  <Td>
                    {fila.calificacion?.estado === 'borrador' ? (
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar a ${fila.estudiante.nombre} para publicar`}
                        checked={seleccion.has(fila.calificacion.id)}
                        onChange={() => alternar(fila.calificacion!.id)}
                      />
                    ) : null}
                  </Td>
                  <Td className="font-mono text-xs">{fila.estudiante.matricula ?? '—'}</Td>
                  <Td className="font-medium">{fila.estudiante.nombre}</Td>
                  <Td>
                    {editable(fila) ? (
                      <Entrada
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step="0.01"
                        aria-label={`Calificacion de ${fila.estudiante.nombre}`}
                        aria-invalid={invalido}
                        value={texto}
                        onChange={(e) => setValores((v) => ({ ...v, [id]: e.target.value }))}
                        className="w-24 font-mono"
                      />
                    ) : (
                      <span className="font-mono text-base font-semibold">{fila.calificacion?.valor}</span>
                    )}
                  </Td>
                  <Td>
                    {!fila.calificacion ? (
                      <Insignia tono="neutro">Sin capturar</Insignia>
                    ) : fila.calificacion.estado === 'borrador' ? (
                      <Insignia tono="aviso">Borrador</Insignia>
                    ) : fila.calificacion.estado === 'corregido' ? (
                      <Insignia tono="aviso">Corregida</Insignia>
                    ) : (
                      <Insignia tono="exito">Publicada</Insignia>
                    )}
                  </Td>
                  <Td>
                    {fila.calificacion ? (
                      <Boton
                        variante="tenue"
                        tamano="sm"
                        aria-expanded={historialDe === fila.calificacion.id}
                        onClick={() =>
                          setHistorialDe(historialDe === fila.calificacion!.id ? null : fila.calificacion!.id)
                        }
                      >
                        <History16Regular aria-hidden />v{fila.calificacion.version}
                      </Boton>
                    ) : null}
                  </Td>
                </tr>
                {fila.calificacion && historialDe === fila.calificacion.id ? (
                  <tr>
                    <td colSpan={6} className="border-b border-borde/50 bg-panel/60 px-3 py-3">
                      <Historial calificacionId={fila.calificacion.id} />
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </Tabla>

      {invalidos.length ? (
        <BarraMensaje tono="peligro" role="alert">
          Hay {invalidos.length} valor(es) fuera de la escala 0–100 o con mas de dos decimales.
        </BarraMensaje>
      ) : null}
      {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
      {aviso ? (
        <BarraMensaje tono="exito" role="status">
          {aviso}
        </BarraMensaje>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Boton
          onClick={() => void guardar()}
          disabled={!cambios.length || invalidos.length > 0 || ocupado !== null}
          cargando={ocupado === 'guardar'}
        >
          <Save16Regular aria-hidden />
          Guardar borrador{cambios.length ? ` (${cambios.length})` : ''}
        </Boton>

        <Boton
          variante="contorno"
          onClick={() => setConfirmando(true)}
          disabled={!seleccion.size || hayCambiosSinGuardar || ocupado !== null}
          title={hayCambiosSinGuardar ? 'Guarda los cambios antes de publicar' : undefined}
        >
          <Send16Regular aria-hidden />
          Publicar seleccionadas{seleccion.size ? ` (${seleccion.size})` : ''}
        </Boton>
      </div>

      {confirmando ? (
        <BarraMensaje tono="aviso" role="alertdialog" aria-label="Confirmar publicacion">
          <div className="space-y-3">
            <p>
              Vas a publicar {seleccion.size} calificacion(es). Los estudiantes las veran de inmediato y
              <strong> ya no podras editarlas</strong>: cualquier cambio posterior exige una correccion
              administrativa con motivo.
            </p>
            <div className="flex gap-2">
              <Boton tamano="sm" onClick={() => void publicar()} cargando={ocupado === 'publicar'}>
                Si, publicar
              </Boton>
              <Boton tamano="sm" variante="contorno" onClick={() => setConfirmando(false)}>
                Cancelar
              </Boton>
            </div>
          </div>
        </BarraMensaje>
      ) : null}
    </div>
  );
}

const ESTADO_LEGIBLE: Record<string, string> = {
  borrador: 'Borrador',
  publicado: 'Publicada',
  corregido: 'Corregida',
};

export function Historial({ calificacionId }: { readonly calificacionId: string }) {
  const historial = useRecurso<VersionHistorial[]>(`/calificaciones/${calificacionId}/historial`);

  if (historial.cargando) return <EstadoCargando etiqueta="Cargando historial" />;
  if (historial.error) {
    return <EstadoError mensaje={historial.error.message} onReintentar={historial.recargar} />;
  }

  return (
    <ol className="space-y-1.5 text-xs">
      {historial.datos?.map((v) => (
        <li key={v.version} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-tenue">v{v.version}</span>
          <span className="font-mono">
            {v.valorAnterior ?? '—'} → <strong>{v.valorNuevo}</strong>
          </span>
          <span>{ESTADO_LEGIBLE[v.estadoNuevo] ?? v.estadoNuevo}</span>
          <span className="text-tenue">{fecha(v.creadaEl)}</span>
          {v.motivo ? <span className="text-tenue">Motivo: {v.motivo}</span> : null}
        </li>
      ))}
    </ol>
  );
}
