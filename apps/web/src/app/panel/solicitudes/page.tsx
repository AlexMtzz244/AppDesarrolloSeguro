'use client';

import { Add16Regular, MailInbox24Regular } from '@fluentui/react-icons';
import * as React from 'react';
import { useSesion } from '@/componentes/sesion';
import {
  AreaTexto,
  BarraMensaje,
  Boton,
  Campo,
  EncabezadoPagina,
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

interface TipoSolicitud {
  readonly idPublico: string;
  readonly clave: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly slaHoras: number | null;
}

interface SolicitudPropia {
  readonly id: string;
  readonly tipo: { clave: string; nombre: string };
  readonly estado: { clave: string; nombre: string; esFinal: boolean };
  readonly descripcion: string;
  readonly creadaEl: string;
  readonly venceEl: string | null;
  readonly cerradaEl: string | null;
}

interface SolicitudBandeja {
  readonly id: string;
  readonly descripcion: string;
  readonly creadaEl: string;
  readonly venceEl: string | null;
  readonly cerradaEl: string | null;
  readonly titular: { correo: string; matricula: string | null };
  readonly tipo: string;
  readonly estado: { id: string; nombre: string; esFinal: boolean };
  readonly estadosPosibles: { id: string; nombre: string; esFinal: boolean }[];
}

interface Detalle {
  readonly historial: { estado: { nombre: string }; comentario: string | null; creadoEl: string }[];
  readonly adjuntos: { id: string; nombreOriginal: string; disponible: boolean }[];
}

interface DocumentoPropio {
  readonly id: string;
  readonly nombreOriginal: string;
  readonly estadoAntivirus: string;
}

function EstadoSolicitud({ nombre, esFinal, venceEl }: { nombre: string; esFinal: boolean; venceEl: string | null }) {
  const vencida = !esFinal && venceEl !== null && new Date(venceEl) < new Date();
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Insignia tono={esFinal ? 'exito' : 'aviso'}>{nombre}</Insignia>
      {vencida ? <Insignia tono="peligro">Vencida</Insignia> : null}
    </span>
  );
}

/**
 * Solicitudes (RF-060 a RF-063).
 *
 * Quien crea solicitudes ve solo las suyas. Quien las atiende tiene la
 * bandeja y avanza el estado, pero nadie avanza la propia: el titular no
 * tiene `solicitud:modificar`.
 */
export default function PaginaSolicitudes() {
  const { actor } = useSesion();
  const puedeCrear = actor?.permisos.includes('solicitud:crear') ?? false;
  const atiende = actor?.permisos.includes('solicitud:modificar') ?? false;

  return (
    <>
      <EncabezadoPagina
        icono={MailInbox24Regular}
        titulo="Solicitudes"
        descripcion={atiende ? 'Bandeja de atencion de solicitudes.' : 'Tus tramites ante servicios escolares.'}
      />
      {atiende ? <Bandeja /> : null}
      {puedeCrear ? <MisSolicitudes /> : null}
    </>
  );
}

function MisSolicitudes() {
  const { actor } = useSesion();
  const mias = useRecurso<SolicitudPropia[]>('/solicitudes/mias');
  const catalogo = useRecurso<TipoSolicitud[]>('/solicitudes/catalogo');
  const [creando, setCreando] = React.useState(false);
  const [abierta, setAbierta] = React.useState<string | null>(null);
  const puedeAdjuntar = actor?.permisos.includes('documento:leer') ?? false;
  const sinCatalogo = !catalogo.cargando && !catalogo.error && !catalogo.datos?.length;

  return (
    <>
      {sinCatalogo ? (
        <Panel titulo="Catalogo pendiente de configuracion">
          <p className="text-sm">
            Todavia no hay tipos de solicitud dados de alta, asi que no es posible crear ninguna.
          </p>
          <p className="mt-2 text-sm text-tenue">
            El catalogo de tipos, estados, responsables y SLA lo define servicios escolares (decision D-01).
          </p>
        </Panel>
      ) : null}

      {creando && catalogo.datos?.length ? (
        <FormularioSolicitud
          tipos={catalogo.datos}
          puedeAdjuntar={puedeAdjuntar}
          alCancelar={() => setCreando(false)}
          alTerminar={() => {
            setCreando(false);
            mias.recargar();
          }}
        />
      ) : null}

      <Panel
        titulo="Mis solicitudes"
        acciones={
          !creando && catalogo.datos?.length ? (
            <Boton tamano="sm" onClick={() => setCreando(true)}>
              <Add16Regular aria-hidden />
              Nueva solicitud
            </Boton>
          ) : null
        }
      >
        {mias.cargando ? (
          <EstadoCargando />
        ) : mias.error ? (
          <EstadoError mensaje={mias.error.message} correlationId={mias.error.correlationId} onReintentar={mias.recargar} />
        ) : !mias.datos?.length ? (
          <EstadoVacio mensaje="No tienes solicitudes registradas." />
        ) : (
          <Tabla resumen="Solicitudes del usuario">
            <thead>
              <tr>
                <Th>Tipo</Th>
                <Th>Estado</Th>
                <Th>Creada</Th>
                <Th>Vence</Th>
                <Th>Detalle</Th>
              </tr>
            </thead>
            <tbody>
              {mias.datos.map((s) => (
                <React.Fragment key={s.id}>
                  <tr>
                    <Td className="font-medium">{s.tipo.nombre}</Td>
                    <Td>
                      <EstadoSolicitud nombre={s.estado.nombre} esFinal={s.estado.esFinal} venceEl={s.venceEl} />
                    </Td>
                    <Td className="text-xs text-tenue">{fecha(s.creadaEl)}</Td>
                    <Td className="text-xs text-tenue">{fecha(s.venceEl)}</Td>
                    <Td>
                      <Boton
                        variante="tenue"
                        tamano="sm"
                        aria-expanded={abierta === s.id}
                        onClick={() => setAbierta(abierta === s.id ? null : s.id)}
                      >
                        {abierta === s.id ? 'Ocultar' : 'Ver'}
                      </Boton>
                    </Td>
                  </tr>
                  {abierta === s.id ? (
                    <tr>
                      <td colSpan={5} className="border-b border-borde/50 bg-panel/60 px-3 py-4">
                        <p className="mb-3 whitespace-pre-wrap text-sm">{s.descripcion}</p>
                        <DetalleSolicitud id={s.id} />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </Tabla>
        )}
      </Panel>
    </>
  );
}

function FormularioSolicitud({
  tipos,
  puedeAdjuntar,
  alCancelar,
  alTerminar,
}: {
  readonly tipos: TipoSolicitud[];
  readonly puedeAdjuntar: boolean;
  readonly alCancelar: () => void;
  readonly alTerminar: () => void;
}) {
  const documentos = useRecurso<DocumentoPropio[]>(puedeAdjuntar ? '/documentos/mios' : null);
  const limpios = documentos.datos?.filter((d) => d.estadoAntivirus === 'limpio') ?? [];
  const [tipoId, setTipoId] = React.useState(tipos[0]?.idPublico ?? '');
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);
  const tipo = tipos.find((t) => t.idPublico === tipoId);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEnviando(true);
    setError(null);
    try {
      await api.post('/solicitudes', {
        tipoSolicitudId: tipoId,
        descripcion: String(datos.get('descripcion') ?? ''),
        documentoIds: datos.getAll('documentoIds').map(String),
      });
      alTerminar();
    } catch (e) {
      setError(aErrorDeApi(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Panel titulo="Nueva solicitud">
      <form onSubmit={(e) => void enviar(e)} className="max-w-xl space-y-4">
        <Campo
          id="solicitud-tipo"
          etiqueta="Tipo"
          ayuda={tipo ? `${tipo.descripcion}${tipo.slaHoras ? ` · Respuesta en ${tipo.slaHoras} h` : ''}` : undefined}
          requerido
        >
          {(props) => (
            <Selector {...props} value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
              {tipos.map((t) => (
                <option key={t.idPublico} value={t.idPublico}>
                  {t.nombre}
                </option>
              ))}
            </Selector>
          )}
        </Campo>

        <Campo id="solicitud-descripcion" etiqueta="Descripcion" ayuda="Entre 10 y 2000 caracteres." requerido>
          {(props) => <AreaTexto {...props} name="descripcion" rows={4} required minLength={10} maxLength={2000} />}
        </Campo>

        {puedeAdjuntar ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Adjuntos (opcional)</legend>
            {documentos.cargando ? (
              <EstadoCargando />
            ) : !limpios.length ? (
              <p className="text-xs text-tenue">
                No tienes documentos disponibles. Subelos en la seccion Documentos; solo se adjuntan los ya analizados.
              </p>
            ) : (
              limpios.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="documentoIds" value={d.id} />
                  {d.nombreOriginal}
                </label>
              ))
            )}
          </fieldset>
        ) : null}

        {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

        <div className="flex gap-2">
          <Boton type="submit" cargando={enviando}>
            Enviar solicitud
          </Boton>
          <Boton type="button" variante="contorno" onClick={alCancelar}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Panel>
  );
}

function DetalleSolicitud({ id, ajena = false }: { readonly id: string; readonly ajena?: boolean }) {
  const detalle = useRecurso<Detalle>(`/solicitudes/${id}`);
  const base = process.env['NEXT_PUBLIC_API_URL'] ?? '';

  if (detalle.cargando) return <EstadoCargando etiqueta="Cargando historial" />;
  if (detalle.error) return <EstadoError mensaje={detalle.error.message} onReintentar={detalle.recargar} />;
  if (!detalle.datos) return null;

  return (
    <div className="grid gap-4 text-xs sm:grid-cols-2">
      <div>
        <h3 className="mb-2 font-semibold uppercase tracking-wide text-tenue">Historial</h3>
        <ol className="space-y-1.5">
          {detalle.datos.historial.map((h, i) => (
            <li key={i}>
              <span className="font-medium">{h.estado.nombre}</span>{' '}
              <span className="text-tenue">{fecha(h.creadoEl)}</span>
              {h.comentario ? <p className="text-tenue">{h.comentario}</p> : null}
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="mb-2 font-semibold uppercase tracking-wide text-tenue">Adjuntos</h3>
        {!detalle.datos.adjuntos.length ? (
          <p className="text-tenue">Sin adjuntos.</p>
        ) : (
          <ul className="space-y-1.5">
            {detalle.datos.adjuntos.map((a) => (
              <li key={a.id}>
                {a.disponible ? (
                  <a
                    className="text-primario underline-offset-4 hover:underline"
                    href={`${base}/api/documentos/${a.id}/descargar`}
                    onClick={(evento) => {
                      if (!ajena) return;
                      // Descargar el documento de otra persona exige motivo, y queda auditado (RF-052).
                      evento.preventDefault();
                      const motivo = window.prompt('Motivo de la descarga (minimo 10 caracteres):')?.trim();
                      if (motivo && motivo.length >= 10) {
                        window.location.href = `${evento.currentTarget.href}?motivo=${encodeURIComponent(motivo)}`;
                      }
                    }}
                  >
                    {a.nombreOriginal}
                  </a>
                ) : (
                  <span className="text-tenue">{a.nombreOriginal} (en analisis)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Bandeja() {
  const bandeja = useRecurso<SolicitudBandeja[]>('/solicitudes/bandeja');
  const [abierta, setAbierta] = React.useState<string | null>(null);

  return (
    <Panel titulo="Bandeja de atencion" descripcion="Abiertas primero, ordenadas por vencimiento. Cada cambio avisa al titular.">
      {bandeja.cargando ? (
        <EstadoCargando />
      ) : bandeja.error ? (
        <EstadoError mensaje={bandeja.error.message} correlationId={bandeja.error.correlationId} onReintentar={bandeja.recargar} />
      ) : !bandeja.datos?.length ? (
        <EstadoVacio mensaje="No hay solicitudes." />
      ) : (
        <Tabla resumen="Bandeja de solicitudes">
          <thead>
            <tr>
              <Th>Titular</Th>
              <Th>Tipo</Th>
              <Th>Estado</Th>
              <Th>Creada</Th>
              <Th>Vence</Th>
              <Th>Atender</Th>
            </tr>
          </thead>
          <tbody>
            {bandeja.datos.map((s) => (
              <React.Fragment key={s.id}>
                <tr>
                  <Td className="text-xs">
                    <span className="block font-medium">{s.titular.correo}</span>
                    <span className="font-mono text-tenue">{s.titular.matricula ?? ''}</span>
                  </Td>
                  <Td>{s.tipo}</Td>
                  <Td>
                    <EstadoSolicitud nombre={s.estado.nombre} esFinal={s.estado.esFinal} venceEl={s.venceEl} />
                  </Td>
                  <Td className="text-xs text-tenue">{fecha(s.creadaEl)}</Td>
                  <Td className="text-xs text-tenue">{fecha(s.venceEl)}</Td>
                  <Td>
                    <Boton
                      variante="contorno"
                      tamano="sm"
                      aria-expanded={abierta === s.id}
                      onClick={() => setAbierta(abierta === s.id ? null : s.id)}
                    >
                      {abierta === s.id ? 'Ocultar' : 'Atender'}
                    </Boton>
                  </Td>
                </tr>
                {abierta === s.id ? (
                  <tr>
                    <td colSpan={6} className="border-b border-borde/50 bg-panel/60 px-3 py-4">
                      <div className="space-y-4">
                        <p className="whitespace-pre-wrap text-sm">{s.descripcion}</p>
                        <DetalleSolicitud id={s.id} ajena />
                        <CambioEstado
                          solicitud={s}
                          alTerminar={() => {
                            setAbierta(null);
                            bandeja.recargar();
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
          </tbody>
        </Tabla>
      )}
    </Panel>
  );
}

function CambioEstado({ solicitud, alTerminar }: { readonly solicitud: SolicitudBandeja; readonly alTerminar: () => void }) {
  const destinos = solicitud.estadosPosibles.filter((e) => e.id !== solicitud.estado.id);
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  if (solicitud.estado.esFinal) {
    return <BarraMensaje>Esta solicitud ya esta cerrada ({solicitud.estado.nombre}).</BarraMensaje>;
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const comentario = String(datos.get('comentario') ?? '').trim();
    setEnviando(true);
    setError(null);
    try {
      await api.patch(`/solicitudes/${solicitud.id}/estado`, {
        solicitudId: solicitud.id,
        estadoDestinoId: String(datos.get('estadoDestinoId') ?? ''),
        ...(comentario ? { comentario } : {}),
      });
      alTerminar();
    } catch (e) {
      setError(aErrorDeApi(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="max-w-lg space-y-3 border-t border-borde pt-3">
      <Campo id={`destino-${solicitud.id}`} etiqueta="Nuevo estado" requerido>
        {(props) => (
          <Selector {...props} name="estadoDestinoId" required>
            {destinos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
                {e.esFinal ? ' (cierra la solicitud)' : ''}
              </option>
            ))}
          </Selector>
        )}
      </Campo>
      <Campo id={`comentario-${solicitud.id}`} etiqueta="Comentario para el titular">
        {(props) => <AreaTexto {...props} name="comentario" rows={2} maxLength={2000} />}
      </Campo>
      {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
      <Boton type="submit" tamano="sm" cargando={enviando}>
        Cambiar estado
      </Boton>
    </form>
  );
}
