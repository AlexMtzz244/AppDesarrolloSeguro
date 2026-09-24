'use client';

import { MailInbox24Regular } from '@fluentui/react-icons';
import * as React from 'react';
import type { SolicitudResumen } from '@securecampus/contracts';
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

interface TipoSolicitud {
  readonly idPublico: string;
  readonly clave: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly slaHoras: number | null;
}

/**
 * Solicitudes del propio usuario (RF-061).
 *
 * Si el catalogo esta vacio, esta pantalla lo dice en vez de inventar tipos.
 * D-01 es una decision de servicios escolares, y como dice SC-SRS-001 §8,
 * "codificar un valor inventado no lo convierte en decidido, lo convierte en
 * invisible, que es peor". Mostrar el hueco es preferible a taparlo.
 */
export default function PaginaSolicitudes() {
  const mias = useRecurso<SolicitudResumen[]>('/solicitudes/mias');
  const catalogo = useRecurso<TipoSolicitud[]>('/solicitudes/catalogo');

  return (
    <>
      <EncabezadoPagina
        icono={MailInbox24Regular}
        titulo="Solicitudes"
        descripcion="Solo las tuyas."
      />

      {!catalogo.cargando && !catalogo.error && !catalogo.datos?.length ? (
        <Panel titulo="Catalogo pendiente de configuracion">
          <p className="text-sm">
            Todavia no hay tipos de solicitud dados de alta, asi que no es posible crear ninguna.
          </p>
          <p className="mt-2 text-sm text-tenue">
            El catalogo de tipos, estados, responsables y SLA lo define servicios escolares
            (decision D-01). El sistema no crea tipos por omision a proposito: seria inventar una
            regla academica que nadie aprobo.
          </p>
        </Panel>
      ) : null}

      <Panel titulo="Mis solicitudes">
        {mias.cargando ? (
          <EstadoCargando />
        ) : mias.error ? (
          <EstadoError
            mensaje={mias.error.message}
            correlationId={mias.error.correlationId}
            onReintentar={mias.recargar}
          />
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
              </tr>
            </thead>
            <tbody>
              {mias.datos.map((solicitud) => (
                <tr key={solicitud.id}>
                  <Td className="font-medium">{solicitud.tipo}</Td>
                  <Td>
                    <Insignia>{solicitud.estado}</Insignia>
                  </Td>
                  <Td className="text-xs text-tenue">{fecha(solicitud.creadaEl)}</Td>
                  <Td className="text-xs text-tenue">{fecha(solicitud.venceEl)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Panel>
    </>
  );
}
