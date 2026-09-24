'use client';

import { Signature24Regular } from '@fluentui/react-icons';
import * as React from 'react';
import type { IdDecision } from '@securecampus/contracts';
import { useSesion } from '@/componentes/sesion';
import {
  AreaTexto,
  Boton,
  Campo,
  Entrada,
  EstadoCargando,
  EstadoError,
  Insignia,
  Panel,
  EncabezadoPagina,
} from '@/componentes/ui';
import { api, ErrorDeApi } from '@/lib/api';
import { useRecurso } from '@/lib/use-recurso';
import { fecha } from '@/lib/utilidades';

interface DecisionFila {
  readonly id: IdDecision;
  readonly titulo: string;
  readonly apruebaArea: string;
  readonly bloqueaProduccion: boolean;
  readonly propuesta: string;
  readonly aprobada: boolean;
  readonly aprobadoPor: string | null;
  readonly aprobadoEl: string | null;
}

/**
 * Estado de las once decisiones institucionales (SC-SRS-001 §8).
 *
 * # Por qué esta pantalla la ve cualquier usuario autenticado
 *
 * Porque el propósito de todo este mecanismo es que las propuestas sin firmar
 * **no sean invisibles**. Restringir la vista a administradores volvería a
 * esconder exactamente lo que se quiere exponer.
 *
 * Aprobar sí es privilegiado: exige `rol:administrar`, segundo factor y
 * motivo, el mismo trato que un cambio de privilegio.
 */
export default function PaginaDecisiones() {
  const { actor } = useSesion();
  const decisiones = useRecurso<DecisionFila[]>('/decisiones');
  const [abierta, setAbierta] = React.useState<string | null>(null);

  const puedeAprobar = actor?.permisos.includes('rol:administrar') ?? false;

  const pendientesBloqueantes =
    decisiones.datos?.filter((d) => d.bloqueaProduccion && !d.aprobada) ?? [];

  return (
    <>
      <EncabezadoPagina
        icono={Signature24Regular}
        titulo="Decisiones institucionales"
        descripcion="Once decisiones que corresponden a la institución, no al equipo de desarrollo. El sistema propone un valor y funciona con él, pero una propuesta sin firma no es una decisión."
      />

      {decisiones.cargando ? (
        <EstadoCargando etiqueta="Consultando estado de aprobación" />
      ) : decisiones.error ? (
        <EstadoError
          mensaje={decisiones.error.message}
          correlationId={decisiones.error.correlationId}
          onReintentar={decisiones.recargar}
        />
      ) : (
        <>
          {pendientesBloqueantes.length > 0 ? (
            <div
              role="alert"
              className="rounded-lg border border-peligro/40 bg-peligro/5 p-4 text-sm"
            >
              <p className="font-medium">
                {pendientesBloqueantes.length} decisión(es) impiden el arranque en producción.
              </p>
              <p className="mt-1 text-tenue">
                La aplicación se niega a iniciar con <code className="font-mono">NODE_ENV=production</code>{' '}
                mientras sigan sin firma. Es deliberado: un valor que bloquea el despliegue no puede
                pasar inadvertido, que es justo lo que se quiere evitar.
              </p>
            </div>
          ) : (
            <div
              role="status"
              className="rounded-lg border border-exito/40 bg-exito/5 p-4 text-sm"
            >
              <p className="font-medium">Todas las decisiones bloqueantes están firmadas.</p>
            </div>
          )}

          <div className="space-y-3">
            {decisiones.datos?.map((decision) => (
              <Panel
                key={decision.id}
                titulo={`${decision.id} · ${decision.titulo}`}
                descripcion={`Aprueba: ${decision.apruebaArea}`}
                acciones={
                  decision.aprobada ? (
                    <Insignia tono="exito">Firmada</Insignia>
                  ) : decision.bloqueaProduccion ? (
                    <Insignia tono="peligro">Bloquea producción</Insignia>
                  ) : (
                    <Insignia tono="aviso">Sin firma</Insignia>
                  )
                }
              >
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-medium text-tenue">Propuesta del equipo</p>
                    <p className="mt-0.5">{decision.propuesta}</p>
                  </div>

                  {decision.aprobada ? (
                    <p className="text-xs text-tenue">
                      Firmada por <strong>{decision.aprobadoPor}</strong> el{' '}
                      {fecha(decision.aprobadoEl)}.
                    </p>
                  ) : puedeAprobar ? (
                    abierta === decision.id ? (
                      <FormularioFirma
                        decision={decision}
                        alFirmar={() => {
                          setAbierta(null);
                          decisiones.recargar();
                        }}
                        alCancelar={() => setAbierta(null)}
                      />
                    ) : (
                      <Boton tamano="sm" variante="contorno" onClick={() => setAbierta(decision.id)}>
                        Registrar firma
                      </Boton>
                    )
                  ) : (
                    <p className="text-xs text-tenue">
                      Solo una cuenta administrativa, con segundo factor verificado, puede registrar
                      la firma.
                    </p>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function FormularioFirma({
  decision,
  alFirmar,
  alCancelar,
}: {
  readonly decision: DecisionFila;
  readonly alFirmar: () => void;
  readonly alCancelar: () => void;
}) {
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setOcupado(true);
    setError(null);
    try {
      await api.post(`/decisiones/${decision.id}/aprobar`, {
        aprobadoPor: String(datos.get('aprobadoPor') ?? ''),
        motivo: String(datos.get('motivo') ?? ''),
      });
      alFirmar();
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="max-w-md space-y-3 rounded-md border border-borde p-3">
      <Campo
        id={`firma-${decision.id}`}
        etiqueta="Quién aprueba"
        ayuda={`Nombre y cargo de ${decision.apruebaArea}. No es tu cuenta: quien teclea no es necesariamente quien decide.`}
        requerido
      >
        {(props) => <Entrada {...props} name="aprobadoPor" />}
      </Campo>

      <Campo
        id={`motivo-firma-${decision.id}`}
        etiqueta="Motivo o referencia del acuerdo"
        ayuda="Queda en la bitácora append-only: una vez registrado no se puede borrar."
        requerido
      >
        {(props) => <AreaTexto {...props} name="motivo" rows={2} />}
      </Campo>

      {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

      <div className="flex gap-2">
        <Boton type="submit" tamano="sm" cargando={ocupado}>
          Registrar firma
        </Boton>
        <Boton type="button" variante="contorno" tamano="sm" onClick={alCancelar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
