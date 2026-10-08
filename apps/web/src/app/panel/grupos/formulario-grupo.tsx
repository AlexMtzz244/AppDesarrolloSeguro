'use client';

import { Add16Regular, Dismiss16Regular } from '@fluentui/react-icons';
import * as React from 'react';
import { DIAS_SEMANA } from '@securecampus/contracts';
import {
  AreaTexto,
  Boton,
  Campo,
  Entrada,
  EstadoCargando,
  EstadoError,
  Panel,
  Selector,
} from '@/componentes/ui';
import { aErrorDeApi, api, type ErrorDeApi } from '@/lib/api';
import { useRecurso } from '@/lib/use-recurso';

interface Catalogo {
  readonly idPublico: string;
  readonly clave: string;
  readonly nombre?: string;
  readonly edificio?: string;
  readonly capacidad?: number;
}

interface Periodo {
  readonly id: string;
  readonly clave: string;
  readonly estado: string;
}

interface Bloque {
  readonly llave: number;
  dia: (typeof DIAS_SEMANA)[number];
  horaInicio: string;
  horaFin: string;
}

/**
 * Alta de grupo (RF-023).
 *
 * El formulario no tiene campo de programa: el servidor lo toma de la
 * adscripcion del jefe. Solo se ofrecen periodos abiertos, pero el control
 * real es el 409 `PERIODO_CERRADO` de la API.
 */
export function FormularioGrupo({ alTerminar }: { readonly alTerminar: () => void }) {
  const materias = useRecurso<Catalogo[]>('/materias');
  const aulas = useRecurso<Catalogo[]>('/aulas');
  const periodos = useRecurso<Periodo[]>('/periodos');
  const [bloques, setBloques] = React.useState<Bloque[]>([
    { llave: 1, dia: 'lunes', horaInicio: '07:00', horaFin: '09:00' },
  ]);
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  const abiertos = periodos.datos?.filter((p) => p.estado === 'abierto') ?? [];
  const cargando = materias.cargando || aulas.cargando || periodos.cargando;
  const fallo = materias.error ?? aulas.error ?? periodos.error;

  function cambiarBloque(llave: number, cambio: Partial<Omit<Bloque, 'llave'>>) {
    setBloques((actual) => actual.map((b) => (b.llave === llave ? { ...b, ...cambio } : b)));
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEnviando(true);
    setError(null);
    try {
      await api.post('/grupos', {
        clave: String(datos.get('clave') ?? '').trim().toUpperCase(),
        materiaId: String(datos.get('materiaId') ?? ''),
        periodoId: String(datos.get('periodoId') ?? ''),
        aulaId: String(datos.get('aulaId') ?? ''),
        cupo: Number(datos.get('cupo')),
        horario: bloques.map(({ dia, horaInicio, horaFin }) => ({ dia, horaInicio, horaFin })),
        motivo: String(datos.get('motivo') ?? ''),
      });
      alTerminar();
    } catch (e) {
      setError(aErrorDeApi(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Panel titulo="Nuevo grupo" descripcion="Se crea en tu programa. Despues asigna profesor e inscribe estudiantes.">
      {cargando ? (
        <EstadoCargando etiqueta="Cargando catalogos" />
      ) : fallo ? (
        <EstadoError mensaje={fallo.message} correlationId={fallo.correlationId} />
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo id="grupo-clave" etiqueta="Clave" ayuda="Mayusculas, digitos y guiones. Ej. ISC-601-B" requerido>
              {(props) => (
                <Entrada {...props} name="clave" required pattern="[A-Za-z0-9-]{3,20}" className="font-mono uppercase" />
              )}
            </Campo>
            <Campo id="grupo-materia" etiqueta="Materia" requerido>
              {(props) => (
                <Selector {...props} name="materiaId" required>
                  {materias.datos?.map((m) => (
                    <option key={m.idPublico} value={m.idPublico}>
                      {m.clave} · {m.nombre}
                    </option>
                  ))}
                </Selector>
              )}
            </Campo>
            <Campo id="grupo-periodo" etiqueta="Periodo" requerido>
              {(props) => (
                <Selector {...props} name="periodoId" required>
                  {abiertos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.clave}
                    </option>
                  ))}
                </Selector>
              )}
            </Campo>
            <Campo id="grupo-aula" etiqueta="Aula" requerido>
              {(props) => (
                <Selector {...props} name="aulaId" required>
                  {aulas.datos?.map((a) => (
                    <option key={a.idPublico} value={a.idPublico}>
                      {a.clave} · edificio {a.edificio} · {a.capacidad} lugares
                    </option>
                  ))}
                </Selector>
              )}
            </Campo>
            <Campo id="grupo-cupo" etiqueta="Cupo" requerido>
              {(props) => <Entrada {...props} name="cupo" type="number" min={1} max={200} defaultValue={30} required />}
            </Campo>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Horario</legend>
            {bloques.map((b) => (
              <div key={b.llave} className="flex flex-wrap items-center gap-2">
                <Selector
                  aria-label="Dia"
                  value={b.dia}
                  onChange={(e) => cambiarBloque(b.llave, { dia: e.target.value as Bloque['dia'] })}
                  className="w-36"
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Selector>
                <Entrada
                  aria-label="Hora de inicio"
                  type="time"
                  value={b.horaInicio}
                  onChange={(e) => cambiarBloque(b.llave, { horaInicio: e.target.value })}
                  className="w-32"
                  required
                />
                <span className="text-tenue">a</span>
                <Entrada
                  aria-label="Hora de fin"
                  type="time"
                  value={b.horaFin}
                  onChange={(e) => cambiarBloque(b.llave, { horaFin: e.target.value })}
                  className="w-32"
                  required
                />
                {bloques.length > 1 ? (
                  <Boton
                    type="button"
                    variante="tenue"
                    tamano="sm"
                    aria-label="Quitar bloque"
                    onClick={() => setBloques((actual) => actual.filter((x) => x.llave !== b.llave))}
                  >
                    <Dismiss16Regular aria-hidden />
                  </Boton>
                ) : null}
              </div>
            ))}
            <Boton
              type="button"
              variante="texto"
              tamano="sm"
              onClick={() =>
                setBloques((actual) => [
                  ...actual,
                  { llave: Math.max(...actual.map((x) => x.llave)) + 1, dia: 'miercoles', horaInicio: '07:00', horaFin: '09:00' },
                ])
              }
            >
              <Add16Regular aria-hidden />
              Agregar bloque
            </Boton>
          </fieldset>

          <div className="max-w-lg">
            <Campo id="grupo-motivo" etiqueta="Motivo" ayuda="Queda en la bitacora. Minimo 10 caracteres." requerido>
              {(props) => <AreaTexto {...props} name="motivo" rows={2} required minLength={10} />}
            </Campo>
          </div>

          {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

          <Boton type="submit" cargando={enviando} disabled={!abiertos.length}>
            Crear grupo
          </Boton>
        </form>
      )}
    </Panel>
  );
}
