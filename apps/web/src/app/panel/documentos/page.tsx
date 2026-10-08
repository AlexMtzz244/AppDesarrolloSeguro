'use client';

import { ArrowUpload16Regular, Document24Regular } from '@fluentui/react-icons';
import * as React from 'react';
import type { CuotaUsuario, DocumentoResumen } from '@securecampus/contracts';
import { useSesion } from '@/componentes/sesion';
import {
  BarraMensaje,
  Boton,
  Campo,
  Entrada,
  Selector,
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
import { aErrorDeApi, api, type ErrorDeApi } from '@/lib/api';
import { useRecurso } from '@/lib/use-recurso';
import { bytes, fecha } from '@/lib/utilidades';

// La API entrega el tipo como objeto, no como la cadena del contrato.
type Documento = Omit<DocumentoResumen, 'tipoDocumento'> & {
  readonly tipoDocumento: { clave: string; nombre: string };
};

interface TipoDocumento {
  readonly clave: string;
  readonly nombre: string;
  readonly mimesPermitidos: string[];
  readonly tamanoMaximoBytes: number;
}

const EXTENSIONES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg,.jpeg',
  'image/png': '.png',
};

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
  const { actor } = useSesion();
  const puedeSubir = actor?.permisos.includes('documento:crear') ?? false;
  const documentos = useRecurso<Documento[]>('/documentos/mios');
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

      {puedeSubir ? (
        <FormularioCarga
          alTerminar={() => {
            documentos.recargar();
            cuota.recargar();
          }}
        />
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
                    <Td className="text-xs text-tenue">{documento.tipoDocumento.nombre}</Td>
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

/**
 * Carga de documentos (RF-050).
 *
 * El `accept` del selector es solo una ayuda: el servidor vuelve a mirar los
 * magic bytes y rechaza un ejecutable renombrado a .pdf (RNFS-044).
 */
function FormularioCarga({ alTerminar }: { readonly alTerminar: () => void }) {
  const tipos = useRecurso<TipoDocumento[]>('/documentos/tipos');
  const [tipo, setTipo] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<ErrorDeApi | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!tipo && tipos.datos?.[0]) setTipo(tipos.datos[0].clave);
  }, [tipos.datos, tipo]);

  const elegido = tipos.datos?.find((t) => t.clave === tipo);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const archivo = (formulario.elements.namedItem('archivo') as HTMLInputElement).files?.[0];
    if (!archivo) return;
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      const datos = new FormData();
      datos.append('archivo', archivo);
      await api.subir(`/documentos?tipo=${encodeURIComponent(tipo)}`, datos);
      formulario.reset();
      setAviso('Documento recibido. Estara disponible cuando el antivirus termine de analizarlo.');
      alTerminar();
    } catch (e) {
      setError(aErrorDeApi(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Panel titulo="Subir documento" descripcion="Pasa por cuarentena y antivirus antes de poder descargarse.">
      {tipos.cargando ? (
        <EstadoCargando />
      ) : tipos.error ? (
        <EstadoError mensaje={tipos.error.message} onReintentar={tipos.recargar} />
      ) : !tipos.datos?.length ? (
        <EstadoVacio mensaje="No hay tipos de documento habilitados." />
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Campo id="doc-tipo" etiqueta="Tipo de documento" requerido>
            {(props) => (
              <Selector {...props} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {tipos.datos!.map((t) => (
                  <option key={t.clave} value={t.clave}>
                    {t.nombre}
                  </option>
                ))}
              </Selector>
            )}
          </Campo>
          <Campo
            id="doc-archivo"
            etiqueta="Archivo"
            ayuda={
              elegido
                ? `${elegido.mimesPermitidos.map((m) => EXTENSIONES[m] ?? m).join(', ')} · maximo ${bytes(elegido.tamanoMaximoBytes)}`
                : undefined
            }
            requerido
          >
            {(props) => (
              <Entrada
                {...props}
                name="archivo"
                type="file"
                required
                accept={elegido?.mimesPermitidos.join(',')}
                className="h-auto py-1.5 file:mr-3 file:rounded file:border-0 file:bg-primario-suave file:px-2 file:py-1 file:text-xs file:font-semibold file:text-primario"
              />
            )}
          </Campo>
          <div className="space-y-3 sm:col-span-2">
            {error ? <EstadoError mensaje={error.message} correlationId={error.correlationId} /> : null}
            {aviso ? (
              <BarraMensaje tono="exito" role="status">
                {aviso}
              </BarraMensaje>
            ) : null}
            <Boton type="submit" cargando={enviando} disabled={!tipo}>
              <ArrowUpload16Regular aria-hidden />
              Subir
            </Boton>
          </div>
        </form>
      )}
    </Panel>
  );
}
