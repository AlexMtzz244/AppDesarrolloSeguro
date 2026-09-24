'use client';

import { PeopleTeam24Regular } from '@fluentui/react-icons';
import * as React from 'react';
import { useSesion } from '@/componentes/sesion';
import {
  Boton,
  Campo,
  Entrada,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Insignia,
  Panel,
  AreaTexto,
  Tabla,
  Td,
  Th,
  EncabezadoPagina,
} from '@/componentes/ui';
import { api, ErrorDeApi } from '@/lib/api';
import { useRecurso } from '@/lib/use-recurso';
import { fecha } from '@/lib/utilidades';

interface Grupo {
  readonly id: string;
  readonly clave: string;
  readonly cupo: number;
  readonly inscritos: number;
  readonly materia: { clave: string; nombre: string };
  readonly periodo: { clave: string; estado: string };
  readonly aula: { clave: string; edificio: string };
  readonly programa: { clave: string; nombre: string };
  readonly horario: { dia: string; horaInicio: string; horaFin: string }[];
  readonly profesor: { idPublico: string; correo: string } | null;
}

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

export default function PaginaGrupos() {
  const { actor } = useSesion();
  const esJefe = actor?.permisos.includes('asignacion-docente:crear') ?? false;

  const grupos = useRecurso<Grupo[]>('/grupos');
  const [expandido, setExpandido] = React.useState<string | null>(null);

  return (
    <>
      <EncabezadoPagina
        icono={PeopleTeam24Regular}
        titulo="Grupos"
        descripcion={
          esJefe
            ? 'Grupos de tu programa. El alcance lo determina tu adscripcion, no un filtro de esta pantalla.'
            : 'Grupos con asignacion docente vigente a tu nombre.'
        }
      />

      <Panel titulo="Listado">
        {grupos.cargando ? (
          <EstadoCargando />
        ) : grupos.error ? (
          <EstadoError
            mensaje={grupos.error.message}
            correlationId={grupos.error.correlationId}
            onReintentar={grupos.recargar}
          />
        ) : !grupos.datos?.length ? (
          <EstadoVacio mensaje="No hay grupos que mostrar." />
        ) : (
          <Tabla resumen="Grupos accesibles para el usuario">
            <thead>
              <tr>
                <Th>Grupo</Th>
                <Th>Materia</Th>
                <Th>Periodo</Th>
                <Th>Horario</Th>
                <Th>Profesor</Th>
                <Th>Inscritos</Th>
                {esJefe ? <Th>Historial</Th> : null}
              </tr>
            </thead>
            <tbody>
              {grupos.datos.map((grupo) => (
                <React.Fragment key={grupo.id}>
                  <tr>
                    <Td className="font-mono text-xs font-medium">{grupo.clave}</Td>
                    <Td>{grupo.materia.nombre}</Td>
                    <Td>
                      <span className="font-mono text-xs">{grupo.periodo.clave}</span>{' '}
                      {grupo.periodo.estado === 'cerrado' ? (
                        <Insignia tono="neutro">Cerrado</Insignia>
                      ) : null}
                    </Td>
                    <Td className="text-xs">
                      {grupo.horario.map((bloque) => (
                        <span key={`${bloque.dia}${bloque.horaInicio}`} className="block">
                          {bloque.dia} {bloque.horaInicio}–{bloque.horaFin}
                        </span>
                      ))}
                    </Td>
                    <Td className="text-xs">
                      {grupo.profesor ? (
                        grupo.profesor.correo
                      ) : (
                        <Insignia tono="aviso">Sin asignar</Insignia>
                      )}
                    </Td>
                    <Td className="font-mono text-xs">
                      {grupo.inscritos}/{grupo.cupo}
                    </Td>
                    {esJefe ? (
                      <Td>
                        <Boton
                          variante="contorno"
                          tamano="sm"
                          aria-expanded={expandido === grupo.id}
                          onClick={() => setExpandido(expandido === grupo.id ? null : grupo.id)}
                        >
                          {expandido === grupo.id ? 'Ocultar' : 'Ver'}
                        </Boton>
                      </Td>
                    ) : null}
                  </tr>

                  {esJefe && expandido === grupo.id ? (
                    <tr>
                      <Td className="bg-panel/60" >
                        <div className="col-span-full">
                          <HistorialAsignaciones grupoId={grupo.id} alCambiar={grupos.recargar} />
                        </div>
                      </Td>
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

/**
 * Historial completo de asignaciones docentes (RF-031).
 *
 * Muestra TODAS las versiones, incluidas las cerradas, y no solo la vigente.
 * Es deliberado: el ataque del escenario 5 de SC-LAB-001 termina en un estado
 * final perfectamente consistente —el jefe se asigna, califica y revierte— y
 * lo unico que lo delata es la version intermedia. Una pantalla que solo
 * mostrara "el profesor actual" lo ocultaria igual de bien que un campo
 * sobrescribible.
 */
function HistorialAsignaciones({
  grupoId,
  alCambiar,
}: {
  readonly grupoId: string;
  readonly alCambiar: () => void;
}) {
  const historial = useRecurso<VersionAsignacion[]>(`/grupos/${grupoId}/asignaciones`);
  const [asignando, setAsignando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);

  async function asignar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setAsignando(true);
    setError(null);
    try {
      await api.post(`/grupos/${grupoId}/asignaciones`, {
        grupoId,
        profesorId: String(datos.get('profesorId') ?? ''),
        desde: new Date().toISOString(),
        hasta: null,
        motivo: String(datos.get('motivo') ?? ''),
      });
      historial.recargar();
      alCambiar();
      (evento.target as HTMLFormElement).reset();
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e : null);
    } finally {
      setAsignando(false);
    }
  }

  return (
    <div className="space-y-4 py-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-tenue">
          Historial de asignaciones
        </h3>
        {historial.cargando ? (
          <EstadoCargando />
        ) : historial.error ? (
          <EstadoError mensaje={historial.error.message} onReintentar={historial.recargar} />
        ) : !historial.datos?.length ? (
          <EstadoVacio mensaje="Este grupo nunca ha tenido profesor asignado." />
        ) : (
          <ol className="mt-2 space-y-2">
            {historial.datos.map((version) => (
              <li
                key={version.id}
                className="rounded border border-borde bg-fondo p-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">v{version.version}</span>
                  <span className="font-medium">{version.profesor.correo}</span>
                  {version.vigente ? (
                    <Insignia tono="exito">Vigente</Insignia>
                  ) : (
                    <Insignia tono="neutro">Cerrada</Insignia>
                  )}
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

      <form onSubmit={asignar} className="max-w-md space-y-3 border-t border-borde pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-tenue">
          Asignar profesor
        </h3>

        <Campo
          id={`profesor-${grupoId}`}
          etiqueta="Identificador del profesor"
          ayuda="La asignacion anterior se cierra; no se sobrescribe."
          requerido
        >
          {(props) => <Entrada {...props} name="profesorId" className="font-mono text-xs" />}
        </Campo>

        <Campo
          id={`motivo-${grupoId}`}
          etiqueta="Motivo"
          ayuda="Queda en la bitacora. Minimo 10 caracteres."
          requerido
        >
          {(props) => <AreaTexto {...props} name="motivo" rows={2} />}
        </Campo>

        {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}

        <Boton type="submit" tamano="sm" cargando={asignando}>
          Registrar asignacion
        </Boton>
      </form>
    </div>
  );
}
