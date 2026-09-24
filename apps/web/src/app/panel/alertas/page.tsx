'use client';

import { ShieldError24Regular } from '@fluentui/react-icons';
import * as React from 'react';
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
import { fecha } from '@/lib/utilidades';

interface Alerta {
  readonly id: string;
  readonly tipo: string;
  readonly severidad: string;
  readonly detalle: string;
  readonly creadaEl: string;
  readonly atendidaEl: string | null;
}

interface PaginaAlertas {
  readonly datos: Alerta[];
  readonly pagina: number;
  readonly tamano: number;
  readonly total: number;
}

/** Contexto de cada regla, para que quien la lea sepa por que existe. */
const EXPLICACION: Record<string, string> = {
  'rafaga-403':
    'Muchos accesos denegados desde una cuenta es la firma de alguien recorriendo identificadores.',
  'descargas-masivas':
    'Exfiltracion de documentos por una cuenta que si esta autorizada a descargarlos.',
  'acceso-inusual':
    'Acceso exitoso desde un dispositivo o red que esa cuenta no habia usado antes.',
  'correcciones-anormales':
    'La correccion es un flujo excepcional; un volumen alto sugiere que se usa como via ordinaria.',
  'cambio-privilegio':
    'Todo cambio en el modelo de autorizacion se revisa. No hay un numero "normal" de cambios de rol.',
  'captura-inmediata-tras-asignacion':
    'Primera mitad del escenario 5: un profesor recien asignado que captura de inmediato.',
  'asignacion-revertida-pronto':
    'Segunda mitad: una asignacion que dura minutos no tiene explicacion academica ordinaria.',
};

/**
 * Alertas de seguridad (RF-090).
 *
 * Los controles detectivos de este panel son, para el escenario 5 de
 * SC-LAB-001, el control **principal** y no un complemento: contra un jefe de
 * carrera que actua dentro de sus atribuciones formales la prevencion tiene
 * poco margen, porque asignar profesores es literalmente su trabajo.
 */
export default function PaginaAlertas() {
  const [pagina, setPagina] = React.useState(1);
  const alertas = useRecurso<PaginaAlertas>(`/alertas?pagina=${pagina}&tamano=25`, [pagina]);

  return (
    <>
      <EncabezadoPagina
        icono={ShieldError24Regular}
        titulo="Alertas"
        descripcion="Sin atender primero. Una bitacora que nadie revisa no es un control, es un archivo."
      />

      <Panel titulo="Alertas de seguridad">
        {alertas.cargando ? (
          <EstadoCargando />
        ) : alertas.error ? (
          <EstadoError
            mensaje={alertas.error.message}
            correlationId={alertas.error.correlationId}
            onReintentar={alertas.recargar}
          />
        ) : !alertas.datos?.datos.length ? (
          <EstadoVacio mensaje="No hay alertas registradas." />
        ) : (
          <>
            <Tabla resumen="Alertas de seguridad generadas por las reglas de deteccion">
              <thead>
                <tr>
                  <Th>Severidad</Th>
                  <Th>Tipo</Th>
                  <Th>Detalle</Th>
                  <Th>Fecha</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {alertas.datos.datos.map((alerta) => (
                  <tr key={alerta.id}>
                    <Td>
                      <Insignia
                        tono={
                          alerta.severidad === 'critica' || alerta.severidad === 'alta'
                            ? 'peligro'
                            : alerta.severidad === 'media'
                              ? 'aviso'
                              : 'neutro'
                        }
                      >
                        {alerta.severidad}
                      </Insignia>
                    </Td>
                    <Td className="font-mono text-xs">{alerta.tipo}</Td>
                    <Td className="max-w-md text-xs">
                      <p>{alerta.detalle}</p>
                      {EXPLICACION[alerta.tipo] ? (
                        <p className="mt-1 text-tenue">{EXPLICACION[alerta.tipo]}</p>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-tenue">
                      {fecha(alerta.creadaEl)}
                    </Td>
                    <Td>
                      {alerta.atendidaEl ? (
                        <Insignia tono="exito">Atendida</Insignia>
                      ) : (
                        <Insignia tono="aviso">Pendiente</Insignia>
                      )}
                    </Td>
                  </tr>
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
                Pagina {alertas.datos.pagina} de{' '}
                {Math.max(1, Math.ceil(alertas.datos.total / alertas.datos.tamano))}
              </span>
              <Boton
                variante="contorno"
                tamano="sm"
                disabled={pagina * alertas.datos.tamano >= alertas.datos.total}
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
