'use client';

import { Edit16Regular, Search16Regular } from '@fluentui/react-icons';
import * as React from 'react';
import {
  AreaTexto,
  BarraMensaje,
  Boton,
  Campo,
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

interface Corregible {
  readonly id: string;
  readonly valor: number;
  readonly estado: string;
  readonly version: number;
  readonly actualizadaEl: string;
  readonly grupo: {
    clave: string;
    materia: { clave: string; nombre: string };
    periodo: { id: string; clave: string; estado: string };
  };
}

interface ResultadoBusqueda {
  readonly estudiante: { id: string; correo: string; matricula: string | null; nombre: string };
  readonly calificaciones: Corregible[];
}

interface Autorizacion {
  readonly id: string;
  readonly motivo: string;
  readonly vigenteHasta: string;
  readonly estado: 'vigente' | 'usada' | 'vencida';
}

/**
 * Correccion de calificaciones publicadas (RF-044).
 *
 * Quien corrige no captura (RNFS-007), y cada correccion exige motivo, deja
 * la version anterior y avisa al estudiante por correo sin opcion de
 * silenciarlo. Si el periodo ya cerro, ademas hay que citar una autorizacion
 * extraordinaria que concedio la autoridad academica: otra cuenta.
 */
export function CorreccionCalificaciones() {
  const [matricula, setMatricula] = React.useState('');
  const [resultado, setResultado] = React.useState<ResultadoBusqueda | null | undefined>(undefined);
  const [buscando, setBuscando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);
  const [editando, setEditando] = React.useState<string | null>(null);

  async function buscar(evento?: React.FormEvent) {
    evento?.preventDefault();
    const valor = matricula.trim();
    if (!valor) return;
    setBuscando(true);
    setError(null);
    setEditando(null);
    try {
      setResultado(
        await api.get<ResultadoBusqueda | null>(`/calificaciones/corregibles?matricula=${encodeURIComponent(valor)}`),
      );
    } catch (e) {
      setError(aErrorDeApi(e));
      setResultado(undefined);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <Panel
      titulo="Correccion de calificaciones publicadas"
      descripcion="Exige motivo y segundo factor. El estudiante recibe aviso por correo en cada correccion."
    >
      <div className="space-y-5">
        <form onSubmit={(e) => void buscar(e)} className="flex max-w-md items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="matricula-correccion" className="text-sm font-semibold">
              Matricula del estudiante
            </label>
            <Entrada
              id="matricula-correccion"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              placeholder="ISC202601"
              className="font-mono"
              autoComplete="off"
            />
          </div>
          <Boton type="submit" cargando={buscando} disabled={!matricula.trim()}>
            <Search16Regular aria-hidden />
            Buscar
          </Boton>
        </form>

        {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

        {resultado === null ? (
          <EstadoVacio mensaje="No hay ningun estudiante con esa matricula." />
        ) : resultado ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{resultado.estudiante.nombre}</span>{' '}
              <span className="text-tenue">
                · {resultado.estudiante.matricula} · {resultado.estudiante.correo}
              </span>
            </p>
            {!resultado.calificaciones.length ? (
              <EstadoVacio mensaje="Este estudiante no tiene calificaciones publicadas." />
            ) : (
              <Tabla resumen="Calificaciones publicadas del estudiante">
                <thead>
                  <tr>
                    <Th>Materia</Th>
                    <Th>Grupo</Th>
                    <Th>Periodo</Th>
                    <Th>Calificacion</Th>
                    <Th>Estado</Th>
                    <Th>Accion</Th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.calificaciones.map((c) => (
                    <React.Fragment key={c.id}>
                      <tr>
                        <Td className="font-medium">{c.grupo.materia.nombre}</Td>
                        <Td className="font-mono text-xs">{c.grupo.clave}</Td>
                        <Td>
                          <span className="font-mono text-xs">{c.grupo.periodo.clave}</span>{' '}
                          {c.grupo.periodo.estado === 'cerrado' ? <Insignia tono="neutro">Cerrado</Insignia> : null}
                        </Td>
                        <Td className="font-mono text-base font-semibold">{c.valor}</Td>
                        <Td>
                          {c.estado === 'corregido' ? (
                            <Insignia tono="aviso">Corregida (v{c.version})</Insignia>
                          ) : (
                            <Insignia tono="exito">Publicada</Insignia>
                          )}
                        </Td>
                        <Td>
                          <Boton
                            variante="contorno"
                            tamano="sm"
                            aria-expanded={editando === c.id}
                            onClick={() => setEditando(editando === c.id ? null : c.id)}
                          >
                            <Edit16Regular aria-hidden />
                            {editando === c.id ? 'Cancelar' : 'Corregir'}
                          </Boton>
                        </Td>
                      </tr>
                      {editando === c.id ? (
                        <tr>
                          <td colSpan={6} className="border-b border-borde/50 bg-panel/60 px-3 py-4">
                            <FormularioCorreccion
                              calificacion={c}
                              alTerminar={() => {
                                setEditando(null);
                                void buscar();
                              }}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  ))}
                </tbody>
              </Tabla>
            )}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function FormularioCorreccion({
  calificacion,
  alTerminar,
}: {
  readonly calificacion: Corregible;
  readonly alTerminar: () => void;
}) {
  const retroactiva = calificacion.grupo.periodo.estado === 'cerrado';
  const autorizaciones = useRecurso<Autorizacion[]>(
    retroactiva ? `/periodos/${calificacion.grupo.periodo.id}/autorizaciones` : null,
  );
  const vigentes = autorizaciones.datos?.filter((a) => a.estado === 'vigente') ?? [];

  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEnviando(true);
    setError(null);
    try {
      const autorizacionId = String(datos.get('autorizacionId') ?? '');
      await api.post(`/calificaciones/${calificacion.id}/corregir`, {
        calificacionId: calificacion.id,
        valorNuevo: Number(datos.get('valorNuevo')),
        motivo: String(datos.get('motivo') ?? ''),
        ...(retroactiva && autorizacionId ? { autorizacionId } : {}),
      });
      alTerminar();
    } catch (e) {
      setError(aErrorDeApi(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="max-w-lg space-y-3">
      {retroactiva ? (
        <BarraMensaje tono="aviso">
          El periodo {calificacion.grupo.periodo.clave} esta cerrado. Esta correccion es un cambio
          retroactivo: requiere una autorizacion extraordinaria vigente concedida por la autoridad
          academica, y la consume.
        </BarraMensaje>
      ) : null}

      <Campo id={`valor-${calificacion.id}`} etiqueta={`Nuevo valor (actual: ${calificacion.valor})`} requerido>
        {(props) => (
          <Entrada
            {...props}
            name="valorNuevo"
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            className="w-32 font-mono"
          />
        )}
      </Campo>

      {retroactiva ? (
        autorizaciones.cargando ? (
          <EstadoCargando etiqueta="Cargando autorizaciones" />
        ) : autorizaciones.error ? (
          <EstadoError mensaje={autorizaciones.error.message} onReintentar={autorizaciones.recargar} />
        ) : !vigentes.length ? (
          <BarraMensaje tono="peligro">
            No hay autorizaciones vigentes para este periodo. Solicitala a la autoridad academica.
          </BarraMensaje>
        ) : (
          <Campo id={`autorizacion-${calificacion.id}`} etiqueta="Autorizacion extraordinaria" requerido>
            {(props) => (
              <Selector {...props} name="autorizacionId" required>
                {vigentes.map((a) => (
                  <option key={a.id} value={a.id}>
                    Vence {fecha(a.vigenteHasta)} · {a.motivo.slice(0, 60)}
                  </option>
                ))}
              </Selector>
            )}
          </Campo>
        )
      ) : null}

      <Campo
        id={`motivo-${calificacion.id}`}
        etiqueta="Motivo"
        ayuda="Queda en la bitacora y en el historial de la calificacion. Minimo 10 caracteres."
        requerido
      >
        {(props) => <AreaTexto {...props} name="motivo" rows={2} required minLength={10} />}
      </Campo>

      {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

      <Boton type="submit" variante="peligro" cargando={enviando} disabled={retroactiva && !vigentes.length}>
        Registrar correccion
      </Boton>
    </form>
  );
}
