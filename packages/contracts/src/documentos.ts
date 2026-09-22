import { z } from 'zod';
import { esquemaId, esquemaMotivo } from './comunes.js';

/**
 * Contratos de documentos y solicitudes. Requisitos RF-050 a RF-063.
 *
 * SC-LAB-003 §5 analiza este escenario como el mas caro de corregir tarde,
 * porque es el unico que acumula datos reales con el paso del tiempo: en
 * requisitos el control es gratuito porque el almacen esta vacio; en
 * produccion se convierte en un proyecto de migracion.
 */

export const ESTADOS_ANTIVIRUS = [
  'pendiente',
  'en-cuarentena',
  'limpio',
  'infectado',
  'error-analisis',
] as const;
export type EstadoAntivirus = (typeof ESTADOS_ANTIVIRUS)[number];

/**
 * Un documento solo se entrega si su estado es `limpio` (RNFS-046).
 *
 * `error-analisis` NO se trata como limpio. Si el antivirus no pudo
 * pronunciarse, el archivo se queda retenido: el valor por defecto seguro es
 * negar, no asumir. Es *deny by default* aplicado al contenido.
 */
export function documentoEsEntregable(estado: EstadoAntivirus): boolean {
  return estado === 'limpio';
}

/**
 * Lista blanca por tipo MIME real, verificado con magic bytes.
 *
 * La extension la controla el atacante; confiar en ella es repetir el error de
 * confiar en el identificador de la URL (SC-LAB-001 escenario 2). El conjunto
 * definitivo es configurable (D-04).
 */
export const TIPOS_MIME_PERMITIDOS_POR_DEFECTO = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const esquemaMetadatosCarga = z.object({
  tipoDocumento: z.string().trim().min(1).max(60),
  nombreOriginal: z
    .string()
    .trim()
    .min(1)
    .max(255)
    // El nombre original se conserva solo como metadato para mostrarlo; nunca
    // como ruta. Aun asi se limpia, porque termina en una cabecera HTTP y en
    // el nombre que el navegador propone al guardar.
    .regex(/^[^\\/:*?"<>|\r\n]+$/, 'El nombre del archivo contiene caracteres no permitidos'),
});

export type MetadatosCarga = z.infer<typeof esquemaMetadatosCarga>;

/**
 * Descarga de un documento.
 *
 * `motivo` es opcional en el tipo porque el titular descargando lo suyo no
 * justifica nada. El servidor lo exige cuando resuelve que el solicitante no
 * es el titular (RF-052): la relacion la conoce la politica, no el formulario.
 */
export const esquemaSolicitudDescarga = z.object({
  documentoId: esquemaId,
  motivo: esquemaMotivo.optional(),
});

export interface DocumentoResumen {
  readonly id: string;
  readonly tipoDocumento: string;
  readonly nombreOriginal: string;
  readonly tipoMimeReal: string;
  readonly tamanoBytes: number;
  readonly estadoAntivirus: EstadoAntivirus;
  readonly subidoEl: string;
  // Nunca se expone la clave de almacenamiento: el cliente no debe conocer ni
  // poder construir la ruta del objeto (RNFS-040, RNFS-041).
}

export interface CuotaUsuario {
  readonly usadoBytes: number;
  readonly limiteBytes: number;
  readonly disponibleBytes: number;
}

/** Razones de rechazo de una carga, todas verificadas en el servidor. */
export const RECHAZOS_CARGA = [
  'tipo-no-permitido',
  'contenido-no-coincide-con-extension',
  'excede-tamano-maximo',
  'cuota-agotada',
  'tipo-documento-desconocido',
] as const;

export type RechazoCarga = (typeof RECHAZOS_CARGA)[number];

// --- Solicitudes (RF-060 a RF-063) ----------------------------------------

/**
 * El catalogo de tipos, estados, responsables y SLA es configurable y vive en
 * la base de datos, no aqui (RF-063, D-01).
 *
 * El prompt maestro es explicito en no inventar reglas academicas fijas, y
 * codificar un catalogo seria justo eso: una decision de servicios escolares
 * disfrazada de constante de programa.
 */
export const esquemaCrearSolicitud = z.object({
  tipoSolicitudId: esquemaId,
  descripcion: z.string().trim().min(10).max(2000),
  documentoIds: z.array(esquemaId).max(10).default([]),
});

export type CrearSolicitud = z.infer<typeof esquemaCrearSolicitud>;

export const esquemaCambiarEstadoSolicitud = z.object({
  solicitudId: esquemaId,
  estadoDestinoId: esquemaId,
  comentario: z.string().trim().max(2000).optional(),
});

export interface SolicitudResumen {
  readonly id: string;
  readonly tipo: string;
  readonly estado: string;
  readonly creadaEl: string;
  readonly actualizadaEl: string;
  readonly venceEl: string | null;
}
