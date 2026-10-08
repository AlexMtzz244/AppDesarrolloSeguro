'use client';

import { Add16Regular, CalendarLtr24Regular } from '@fluentui/react-icons';
import * as React from 'react';
import { useSesion } from '@/componentes/sesion';
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
  Tabla,
  Td,
  Th,
} from '@/componentes/ui';
import { aErrorDeApi, api, type ErrorDeApi } from '@/lib/api';
import { useRecurso } from '@/lib/use-recurso';
import { fecha } from '@/lib/utilidades';

interface Periodo {
  readonly id: string;
  readonly clave: string;
  readonly inicia: string;
  readonly termina: string;
  readonly estado: 'abierto' | 'cerrado';
  readonly cerradoEl: string | null;
}

interface Autorizacion {
  readonly id: string;
  readonly motivo: string;
  readonly creadaEl: string;
  readonly vigenteHasta: string;
  readonly usadaEl: string | null;
  readonly estado: 'vigente' | 'usada' | 'vencida';
}

// Inicio y termino son fechas de calendario guardadas a medianoche UTC; con la
// zona local se mostrarian un dia antes.
function dia(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

type Accion = { tipo: 'cerrar' | 'autorizar' | 'historial'; periodoId: string } | null;

/**
 * Periodos academicos y cambios retroactivos (RF-021, RF-033).
 *
 * Aqui se ve el flujo de dos cuentas de D-07: la autoridad academica concede
 * una autorizacion sobre un periodo cerrado y el administrador la consume al
 * corregir. Ninguna de las dos puede hacer la otra mitad, y la pantalla no
 * ofrece el boton que la API de todos modos rechazaria.
 */
export default function PaginaPeriodos() {
  const { actor } = useSesion();
  const puede = (p: string) => actor?.permisos.some((x) => x === p) ?? false;
  const puedeCrear = puede('periodo:crear');
  const puedeCerrar = puede('periodo:modificar');
  const puedeAutorizar = puede('periodo:autorizar-retroactivo');

  const periodos = useRecurso<Periodo[]>('/periodos');
  const [accion, setAccion] = React.useState<Accion>(null);
  const [creando, setCreando] = React.useState(false);

  function alternar(tipo: NonNullable<Accion>['tipo'], periodoId: string) {
    setAccion(accion?.tipo === tipo && accion.periodoId === periodoId ? null : { tipo, periodoId });
  }

  function terminar() {
    setAccion(null);
    periodos.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        icono={CalendarLtr24Regular}
        titulo="Periodos"
        descripcion={
          puedeAutorizar
            ? 'Concede autorizaciones extraordinarias sobre periodos cerrados. Tu no puedes usarlas.'
            : puedeCerrar
              ? 'Alta y cierre de periodos. Un periodo cerrado solo se toca con autorizacion ajena.'
              : 'Periodos academicos y su estado.'
        }
        acciones={
          puedeCrear ? (
            <Boton onClick={() => setCreando((v) => !v)} aria-expanded={creando}>
              <Add16Regular aria-hidden />
              Nuevo periodo
            </Boton>
          ) : null
        }
      />

      {creando ? (
        <FormularioPeriodo
          alTerminar={() => {
            setCreando(false);
            periodos.recargar();
          }}
        />
      ) : null}

      <Panel titulo="Listado">
        {periodos.cargando ? (
          <EstadoCargando />
        ) : periodos.error ? (
          <EstadoError
            mensaje={periodos.error.message}
            correlationId={periodos.error.correlationId}
            onReintentar={periodos.recargar}
          />
        ) : !periodos.datos?.length ? (
          <EstadoVacio mensaje="No hay periodos registrados." />
        ) : (
          <Tabla resumen="Periodos academicos">
            <thead>
              <tr>
                <Th>Clave</Th>
                <Th>Inicia</Th>
                <Th>Termina</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {periodos.datos.map((p) => (
                <React.Fragment key={p.id}>
                  <tr>
                    <Td className="font-mono text-xs font-medium">{p.clave}</Td>
                    <Td className="text-xs">{dia(p.inicia)}</Td>
                    <Td className="text-xs">{dia(p.termina)}</Td>
                    <Td>
                      {p.estado === 'abierto' ? (
                        <Insignia tono="exito">Abierto</Insignia>
                      ) : (
                        <Insignia tono="neutro">Cerrado {p.cerradoEl ? fecha(p.cerradoEl) : ''}</Insignia>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {p.estado === 'abierto' && puedeCerrar ? (
                          <Boton variante="contorno" tamano="sm" onClick={() => alternar('cerrar', p.id)}>
                            Cerrar periodo
                          </Boton>
                        ) : null}
                        {p.estado === 'cerrado' && puedeAutorizar ? (
                          <Boton variante="contorno" tamano="sm" onClick={() => alternar('autorizar', p.id)}>
                            Conceder autorizacion
                          </Boton>
                        ) : null}
                        {p.estado === 'cerrado' ? (
                          <Boton variante="tenue" tamano="sm" onClick={() => alternar('historial', p.id)}>
                            Autorizaciones
                          </Boton>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                  {accion?.periodoId === p.id ? (
                    <tr>
                      <td colSpan={5} className="border-b border-borde/50 bg-panel/60 px-3 py-4">
                        {accion.tipo === 'cerrar' ? (
                          <FormularioCierre periodo={p} alTerminar={terminar} />
                        ) : accion.tipo === 'autorizar' ? (
                          <FormularioAutorizacion periodo={p} alTerminar={() => alternar('historial', p.id)} />
                        ) : (
                          <ListaAutorizaciones periodoId={p.id} />
                        )}
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

function useEnvio() {
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  async function ejecutar(operacion: () => Promise<unknown>, alExito: () => void) {
    setEnviando(true);
    setError(null);
    try {
      await operacion();
      alExito();
    } catch (e) {
      setError(aErrorDeApi(e));
    } finally {
      setEnviando(false);
    }
  }

  return { enviando, error, ejecutar };
}

function FormularioPeriodo({ alTerminar }: { readonly alTerminar: () => void }) {
  const { enviando, error, ejecutar } = useEnvio();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    void ejecutar(
      () =>
        api.post('/periodos', {
          clave: String(datos.get('clave') ?? '').trim(),
          inicia: String(datos.get('inicia') ?? ''),
          termina: String(datos.get('termina') ?? ''),
        }),
      alTerminar,
    );
  }

  return (
    <Panel titulo="Nuevo periodo" descripcion="Se crea abierto. El cierre es una accion aparte, con motivo.">
      <form onSubmit={enviar} className="grid max-w-2xl gap-4 sm:grid-cols-3">
        <Campo id="periodo-clave" etiqueta="Clave" ayuda="Ej. 2027-1" requerido>
          {(props) => <Entrada {...props} name="clave" required minLength={3} maxLength={20} className="font-mono" />}
        </Campo>
        <Campo id="periodo-inicia" etiqueta="Inicia" requerido>
          {(props) => <Entrada {...props} name="inicia" type="date" required />}
        </Campo>
        <Campo id="periodo-termina" etiqueta="Termina" requerido>
          {(props) => <Entrada {...props} name="termina" type="date" required />}
        </Campo>
        <div className="space-y-3 sm:col-span-3">
          {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
          <Boton type="submit" cargando={enviando}>
            Crear periodo
          </Boton>
        </div>
      </form>
    </Panel>
  );
}

function FormularioCierre({ periodo, alTerminar }: { readonly periodo: Periodo; readonly alTerminar: () => void }) {
  const { enviando, error, ejecutar } = useEnvio();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const motivo = String(new FormData(evento.currentTarget).get('motivo') ?? '');
    void ejecutar(() => api.post(`/periodos/${periodo.id}/cerrar`, { motivo }), alTerminar);
  }

  return (
    <form onSubmit={enviar} className="max-w-lg space-y-3">
      <BarraMensaje tono="aviso">
        Al cerrar {periodo.clave} ya no se podra capturar, publicar, crear grupos ni asignar profesores
        en el. Cualquier cambio posterior exige una autorizacion extraordinaria. No se puede reabrir.
      </BarraMensaje>
      <Campo id={`cierre-${periodo.id}`} etiqueta="Motivo" ayuda="Minimo 10 caracteres." requerido>
        {(props) => <AreaTexto {...props} name="motivo" rows={2} required minLength={10} />}
      </Campo>
      {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
      <Boton type="submit" variante="peligro" cargando={enviando}>
        Cerrar {periodo.clave}
      </Boton>
    </form>
  );
}

function FormularioAutorizacion({
  periodo,
  alTerminar,
}: {
  readonly periodo: Periodo;
  readonly alTerminar: () => void;
}) {
  const { enviando, error, ejecutar } = useEnvio();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    void ejecutar(
      () =>
        api.post(`/periodos/${periodo.id}/autorizaciones`, {
          motivo: String(datos.get('motivo') ?? ''),
          vigenteHoras: Number(datos.get('vigenteHoras') ?? 24),
        }),
      alTerminar,
    );
  }

  return (
    <form onSubmit={enviar} className="max-w-lg space-y-3">
      <BarraMensaje tono="aviso">
        Vas a permitir un cambio sobre {periodo.clave}, que esta cerrado. La autorizacion es de un solo
        uso, la ejecuta otra cuenta (el administrador) y genera una alerta critica en el acto.
      </BarraMensaje>
      <Campo id={`horas-${periodo.id}`} etiqueta="Vigencia en horas" ayuda="De 1 a 72." requerido>
        {(props) => (
          <Entrada {...props} name="vigenteHoras" type="number" min={1} max={72} defaultValue={24} required className="w-24" />
        )}
      </Campo>
      <Campo
        id={`motivo-aut-${periodo.id}`}
        etiqueta="Motivo"
        ayuda="Describe exactamente que cambio autorizas. Minimo 10 caracteres."
        requerido
      >
        {(props) => <AreaTexto {...props} name="motivo" rows={3} required minLength={10} />}
      </Campo>
      {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
      <Boton type="submit" variante="peligro" cargando={enviando}>
        Conceder autorizacion
      </Boton>
    </form>
  );
}

const TONO_AUTORIZACION = { vigente: 'aviso', usada: 'neutro', vencida: 'neutro' } as const;

function ListaAutorizaciones({ periodoId }: { readonly periodoId: string }) {
  const lista = useRecurso<Autorizacion[]>(`/periodos/${periodoId}/autorizaciones`);

  if (lista.cargando) return <EstadoCargando etiqueta="Cargando autorizaciones" />;
  if (lista.error) return <EstadoError mensaje={lista.error.message} onReintentar={lista.recargar} />;
  if (!lista.datos?.length) return <EstadoVacio mensaje="Nunca se ha concedido una autorizacion sobre este periodo." />;

  return (
    <ol className="space-y-2">
      {lista.datos.map((a) => (
        <li key={a.id} className="rounded border border-borde bg-fondo p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono={TONO_AUTORIZACION[a.estado]}>
              {a.estado === 'vigente' ? 'Vigente' : a.estado === 'usada' ? 'Usada' : 'Vencida'}
            </Insignia>
            <span className="text-tenue">
              Concedida {fecha(a.creadaEl)} · vence {fecha(a.vigenteHasta)}
              {a.usadaEl ? ` · usada ${fecha(a.usadaEl)}` : ''}
            </span>
          </div>
          <p className="mt-1">
            <span className="text-tenue">Motivo:</span> {a.motivo}
          </p>
        </li>
      ))}
    </ol>
  );
}
