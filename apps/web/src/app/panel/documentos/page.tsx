'use client';

import { Document24Regular } from '@fluentui/react-icons';
import * as React from 'react';
import type { CuotaUsuario, DocumentoResumen } from '@securecampus/contracts';
import {
  Boton,
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
import { bytes, fecha } from '@/lib/utilidades';

/**
 * Documentos del titular (RF-051).
 *
 * La descarga apunta al endpoint de la API, nunca al almacen. Esa es la
 * diferencia entre este diseno y el del escenario 2 de SC-LAB-001, donde el
 * servidor web entregaba el archivo antes de que la aplicacion interviniera.
 * Aqui no existe ninguna URL directa al objeto: el cliente ni siquiera conoce
 * su clave de almacenamiento, porque la API no la incluye en la respuesta.
 */
export default function PaginaDocumentos() {
  const documentos = useRecurso<DocumentoResumen[]>('/documentos/mios');
  const cuota = useRecurso<CuotaUsuario | null>('/documentos/cuota');

  const base = process.env['NEXT_PUBLIC_API_URL'] ?? '';

  return (
    <>
      <EncabezadoPagina
        icono={Document24Regular}
        titulo="Documentos"
        descripcion="Cada descarga queda registrada con quien la pidio y su resultado."
      />

      {cuota.datos ? (
        <Panel titulo="Cuota de almacenamiento">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{bytes(cuota.datos.usadoBytes)} usados</span>
              <span className="text-tenue">de {bytes(cuota.datos.limiteBytes)}</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-texto/10"
              role="progressbar"
              aria-valuenow={Math.round((cuota.datos.usadoBytes / cuota.datos.limiteBytes) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Uso de la cuota de almacenamiento"
            >
              <div
                className="h-full origin-left animate-crecer rounded-full bg-gradient-to-r from-primario to-[hsl(var(--bloom-2))]"
                style={{
                  width: `${Math.min(100, (cuota.datos.usadoBytes / cuota.datos.limiteBytes) * 100)}%`,
                }}
              />
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel
        titulo="Mis documentos"
        descripcion="Un documento solo se entrega despues de que el antivirus lo marca como limpio."
      >
        {documentos.cargando ? (
          <EstadoCargando />
        ) : documentos.error ? (
          <EstadoError
            mensaje={documentos.error.message}
            correlationId={documentos.error.correlationId}
            onReintentar={documentos.recargar}
          />
        ) : !documentos.datos?.length ? (
          <EstadoVacio mensaje="No tienes documentos." />
        ) : (
          <Tabla resumen="Documentos del usuario">
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Tipo</Th>
                <Th>Tamano</Th>
                <Th>Estado</Th>
                <Th>Subido</Th>
                <Th>Accion</Th>
              </tr>
            </thead>
            <tbody>
              {documentos.datos.map((documento) => {
                const disponible = documento.estadoAntivirus === 'limpio';
                return (
                  <tr key={documento.id}>
                    <Td className="font-medium">{documento.nombreOriginal}</Td>
                    <Td className="text-xs text-tenue">{documento.tipoDocumento}</Td>
                    <Td className="font-mono text-xs">{bytes(documento.tamanoBytes)}</Td>
                    <Td>
                      {disponible ? (
                        <Insignia tono="exito">Disponible</Insignia>
                      ) : documento.estadoAntivirus === 'infectado' ? (
                        <Insignia tono="peligro">Retenido</Insignia>
                      ) : (
                        <Insignia tono="aviso">En analisis</Insignia>
                      )}
                    </Td>
                    <Td className="text-xs text-tenue">{fecha(documento.subidoEl)}</Td>
                    <Td>
                      {disponible ? (
                        <Boton asChild variante="contorno" tamano="sm">
                          <a href={`${base}/api/documentos/${documento.id}/descargar`}>Descargar</a>
                        </Boton>
                      ) : (
                        <span className="text-xs text-tenue">No disponible</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        )}
      </Panel>
    </>
  );
}
