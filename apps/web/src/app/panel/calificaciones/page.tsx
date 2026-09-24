'use client';

import { HatGraduation24Regular } from '@fluentui/react-icons';
import * as React from 'react';
import { useSesion } from '@/componentes/sesion';
import {
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Insignia,
  Panel,
  Tabla,
  Td,
  Th,
  EncabezadoPagina,
} from '@/componentes/ui';
import { useRecurso } from '@/lib/use-recurso';
import { fecha } from '@/lib/utilidades';

interface CalificacionPropia {
  readonly id: string;
  readonly valor: number;
  readonly estado: string;
  readonly version: number;
  readonly publicadaEl: string | null;
  readonly actualizadaEl: string;
  readonly grupo: {
    clave: string;
    materia: { clave: string; nombre: string };
    periodo: { clave: string };
  };
}

/**
 * Calificaciones del estudiante (RF-040).
 *
 * Solo aparecen las publicadas o corregidas. Las que el profesor tiene en
 * borrador no se muestran: todavia no son un hecho, y exponerlas convertiria
 * cada captura tentativa en una comunicacion oficial. El filtro lo aplica el
 * servidor; esta pantalla no tendria forma de pedir las de otro alumno ni las
 * que estan en borrador, porque el endpoint no acepta ese parametro.
 */
export default function PaginaCalificaciones() {
  const { actor } = useSesion();
  const puedeCapturar = actor?.permisos.includes('calificacion:crear') ?? false;

  const mias = useRecurso<CalificacionPropia[]>('/calificaciones/mias');

  return (
    <>
      <EncabezadoPagina
        icono={HatGraduation24Regular}
        titulo="Calificaciones"
        descripcion={
          puedeCapturar
            ? 'Entra a un grupo desde la seccion Grupos para capturar.'
            : 'Tus calificaciones publicadas.'
        }
      />

      <Panel
        titulo="Mis calificaciones"
        descripcion="Una calificacion corregida despues de publicarse siempre genera un aviso a tu correo."
      >
        {mias.cargando ? (
          <EstadoCargando />
        ) : mias.error ? (
          <EstadoError
            mensaje={mias.error.message}
            correlationId={mias.error.correlationId}
            onReintentar={mias.recargar}
          />
        ) : !mias.datos?.length ? (
          <EstadoVacio mensaje="Todavia no tienes calificaciones publicadas." />
        ) : (
          <Tabla resumen="Calificaciones publicadas del estudiante">
            <thead>
              <tr>
                <Th>Materia</Th>
                <Th>Grupo</Th>
                <Th>Periodo</Th>
                <Th>Calificacion</Th>
                <Th>Estado</Th>
                <Th>Actualizada</Th>
              </tr>
            </thead>
            <tbody>
              {mias.datos.map((calificacion) => (
                <tr key={calificacion.id}>
                  <Td>
                    <span className="font-medium">{calificacion.grupo.materia.nombre}</span>
                    <span className="block text-xs text-tenue">
                      {calificacion.grupo.materia.clave}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs">{calificacion.grupo.clave}</Td>
                  <Td className="font-mono text-xs">{calificacion.grupo.periodo.clave}</Td>
                  <Td className="font-mono text-base font-semibold">{calificacion.valor}</Td>
                  <Td>
                    {calificacion.estado === 'corregido' ? (
                      // Una correccion se marca de forma visible: es el aviso
                      // que convierte al estudiante en un detector
                      // independiente del propio sistema.
                      <Insignia tono="aviso">Corregida (v{calificacion.version})</Insignia>
                    ) : (
                      <Insignia tono="exito">Publicada</Insignia>
                    )}
                  </Td>
                  <Td className="text-xs text-tenue">{fecha(calificacion.actualizadaEl)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Panel>
    </>
  );
}
