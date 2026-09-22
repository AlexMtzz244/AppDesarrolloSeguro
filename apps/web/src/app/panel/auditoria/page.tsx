'use client';

import * as React from 'react';
import { ACCIONES_AUDITABLES, RESULTADOS_AUDITORIA } from '@securecampus/contracts';
import {
  Boton,
  Campo,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Insignia,
  Panel,
  Tabla,
  Td,
  Th,
} from '@/componentes/ui';
import { useRecurso } from '@/lib/use-recurso';
import { fecha } from '@/lib/utilidades';

interface EventoFila {
  readonly id: string;
  readonly creadoEl: string;
  readonly actorCorreo: string | null;
  readonly accion: string;
  readonly tipoRecurso: string;
  readonly recursoId: string | null;
  readonly resultado: string;
  readonly motivo: string | null;
  readonly antes: unknown;
  readonly despues: unknown;
  readonly ip: string | null;
  readonly correlationId: string;
}

interface PaginaAuditoria {
  readonly datos: EventoFila[];
  readonly pagina: number;
  readonly tamano: number;
  readonly total: number;
}

/**
 * Consulta de la bitacora (RF-080, RF-081).
 *
 * # La ausencia mas importante de esta pantalla
 *
 * **No hay ningun boton de editar ni de borrar, y no los habra.** No es que
 * esten deshabilitados ni ocultos por permiso: la API no ofrece esas
 * operaciones, el rol de base de datos no tiene el privilegio y un trigger las
 * rechaza. Tres capas independientes.
 *
 * SC-LAB-001 escenario 4 explica por que importan las tres: el impacto que mas
 * teme ese escenario es "borrado o manipulacion de los logs, lo que destruye
 * la evidencia del propio ataque y hace imposible reconstruir lo ocurrido".
 *
 * # Y una advertencia
 *
 * Que esta pantalla exista no cierra el control. SC-LAB-002 escenario E:
 * "Una bitacora que nadie revisa no es un control, es un archivo."
 */
export default function PaginaAuditoria() {
  const [pagina, setPagina] = React.useState(1);
  const [accion, setAccion] = React.useState('');
  const [resultado, setResultado] = React.useState('');
  const [expandido, setExpandido] = React.useState<string | null>(null);

  const consulta = new URLSearchParams({ pagina: String(pagina), tamano: '25' });
  if (accion) consulta.set('accion', accion);
  if (resultado) consulta.set('resultado', resultado);

  const eventos = useRecurso<PaginaAuditoria>(`/auditoria?${consulta.toString()}`, [
    pagina,
    accion,
    resultado,
  ]);

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Auditoria</h1>
        <p className="text-sm text-tenue">
          Registro append-only. Esta vista es de solo lectura por diseno, no por configuracion.
        </p>
      </header>

      <Panel titulo="Filtros">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="filtro-accion" etiqueta="Accion">
            {(props) => (
              <select
                {...props}
                value={accion}
                onChange={(e) => {
                  setAccion(e.target.value);
                  setPagina(1);
                }}
                className="flex h-9 w-full rounded-md border border-entrada bg-fondo px-3 text-sm"
              >
                <option value="">Todas</option>
                {ACCIONES_AUDITABLES.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            )}
          </Campo>

          <Campo id="filtro-resultado" etiqueta="Resultado">
            {(props) => (
              <select
                {...props}
                value={resultado}
                onChange={(e) => {
                  setResultado(e.target.value);
                  setPagina(1);
                }}
                className="flex h-9 w-full rounded-md border border-entrada bg-fondo px-3 text-sm"
              >
                <option value="">Todos</option>
                {RESULTADOS_AUDITORIA.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        </div>
      </Panel>

      <Panel titulo="Eventos" descripcion={eventos.datos ? `${eventos.datos.total} registros` : undefined}>
        {eventos.cargando ? (
          <EstadoCargando />
        ) : eventos.error ? (
          <EstadoError
            mensaje={eventos.error.message}
            correlationId={eventos.error.correlationId}
            onReintentar={eventos.recargar}
          />
        ) : !eventos.datos?.datos.length ? (
          <EstadoVacio mensaje="No hay eventos que coincidan con el filtro." />
        ) : (
          <>
            <Tabla resumen="Eventos de la bitacora de auditoria">
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Actor</Th>
                  <Th>Accion</Th>
                  <Th>Recurso</Th>
                  <Th>Resultado</Th>
                  <Th>Detalle</Th>
                </tr>
              </thead>
              <tbody>
                {eventos.datos.datos.map((evento) => (
                  <React.Fragment key={evento.id}>
                    <tr>
                      <Td className="whitespace-nowrap text-xs">{fecha(evento.creadoEl)}</Td>
                      <Td className="text-xs">{evento.actorCorreo ?? 'sistema'}</Td>
                      <Td className="font-mono text-xs">{evento.accion}</Td>
                      <Td className="font-mono text-xs text-tenue">{evento.tipoRecurso}</Td>
                      <Td>
                        <Insignia
                          tono={
                            evento.resultado === 'exito'
                              ? 'exito'
                              : evento.resultado === 'denegado'
                                ? 'peligro'
                                : 'aviso'
                          }
                        >
                          {evento.resultado}
                        </Insignia>
                      </Td>
                      <Td>
                        <Boton
                          variante="texto"
                          tamano="sm"
                          aria-expanded={expandido === evento.id}
                          onClick={() => setExpandido(expandido === evento.id ? null : evento.id)}
                        >
                          {expandido === evento.id ? 'Ocultar' : 'Ver'}
                        </Boton>
                      </Td>
                    </tr>

                    {expandido === evento.id ? (
                      <tr>
                        <Td className="bg-panel/60">
                          <dl className="space-y-2 py-2 text-xs">
                            {evento.motivo ? (
                              <div>
                                <dt className="text-tenue">Motivo</dt>
                                <dd>{evento.motivo}</dd>
                              </div>
                            ) : null}
                            <div>
                              <dt className="text-tenue">Correlacion</dt>
                              <dd className="font-mono">{evento.correlationId}</dd>
                            </div>
                            {evento.ip ? (
                              <div>
                                <dt className="text-tenue">Origen</dt>
                                <dd className="font-mono">{evento.ip}</dd>
                              </div>
                            ) : null}
                            {evento.antes ? (
                              <div>
                                <dt className="text-tenue">Antes</dt>
                                <dd>
                                  <pre className="overflow-x-auto rounded bg-fondo p-2">
                                    {JSON.stringify(evento.antes, null, 2)}
                                  </pre>
                                </dd>
                              </div>
                            ) : null}
                            {evento.despues ? (
                              <div>
                                <dt className="text-tenue">Despues</dt>
                                <dd>
                                  <pre className="overflow-x-auto rounded bg-fondo p-2">
                                    {JSON.stringify(evento.despues, null, 2)}
                                  </pre>
                                </dd>
                              </div>
                            ) : null}
                          </dl>
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
                Pagina {eventos.datos.pagina} de{' '}
                {Math.max(1, Math.ceil(eventos.datos.total / eventos.datos.tamano))}
              </span>
              <Boton
                variante="contorno"
                tamano="sm"
                disabled={pagina * eventos.datos.tamano >= eventos.datos.total}
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
