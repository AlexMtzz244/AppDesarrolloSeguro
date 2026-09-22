import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { correlationIdActual } from './correlacion.js';

/**
 * Traductor unico de errores a respuesta HTTP (RNFS-050).
 *
 * Ninguna respuesta lleva traza, consulta SQL, ruta interna ni nombre de
 * tabla. Lo que el cliente recibe es un codigo, un mensaje neutro y el
 * correlation id; el detalle real va al log del servidor, donde el operador
 * puede buscarlo por ese mismo id.
 *
 * SC-LAB-002 §3, fase Despliegue: "errores genericos sin trazas ni detalles de
 * la consulta... un error cualquiera filtra informacion que ayuda al
 * atacante".
 */
export class ErrorNegocio extends HttpException {
  constructor(
    public readonly codigo: string,
    mensaje: string,
    estado: HttpStatus = HttpStatus.BAD_REQUEST,
    /**
     * Detalle por campo. Es el unico detalle que una respuesta lleva, y es
     * seguro: dice que campo del formulario esta mal segun un esquema que el
     * cliente ya conoce, sin revelar nada del estado del servidor.
     */
    campos?: Record<string, string[]>,
  ) {
    super({ codigo, mensaje, ...(campos ? { campos } : {}) }, estado);
  }
}

/**
 * Denegacion de acceso.
 *
 * Se usa el MISMO error para "el recurso no existe" y para "el recurso existe
 * pero no es tuyo" (RNFS-006). Devolver 404 en un caso y 403 en el otro
 * convierte el endpoint en un detector de existencia: bastaria recorrer
 * identificadores y leer el codigo de respuesta para reconstruir el padron,
 * que es la enumeracion del caso de Maria por otra via.
 */
export class AccesoDenegado extends ErrorNegocio {
  constructor(mensaje = 'No tienes autorizacion para realizar esta operacion.') {
    super('ACCESO_DENEGADO', mensaje, HttpStatus.FORBIDDEN);
  }
}

@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly logger = new Logger(FiltroExcepciones.name);

  constructor(private readonly esProduccion: boolean) {}

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const correlationId = correlationIdActual();

    if (excepcion instanceof HttpException) {
      const estado = excepcion.getStatus();
      const cuerpo = excepcion.getResponse();

      const { codigo, mensaje, campos } = this.normalizar(cuerpo, estado);

      // Los 4xx son informacion de negocio, no incidentes; se registran en
      // nivel bajo salvo el 403, que si interesa para detectar enumeracion
      // (RNFS-033, alerta `rafaga-403`).
      if (estado === HttpStatus.FORBIDDEN) {
        this.logger.warn({ correlationId, codigo, estado }, 'Acceso denegado');
      } else if (estado >= 500) {
        this.logger.error({ correlationId, codigo, estado }, excepcion.message);
      }

      respuesta.status(estado).json({
        codigo,
        mensaje,
        correlationId,
        ...(campos ? { campos } : {}),
      });
      return;
    }

    // Error no previsto. El detalle va al log, nunca a la respuesta.
    this.logger.error(
      { correlationId, error: excepcion instanceof Error ? excepcion.stack : String(excepcion) },
      'Error no controlado',
    );

    respuesta.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      codigo: 'ERROR_INTERNO',
      mensaje: 'Ocurrio un error al procesar la solicitud.',
      correlationId,
    });
  }

  private normalizar(
    cuerpo: unknown,
    estado: number,
  ): { codigo: string; mensaje: string; campos?: Record<string, string[]> } {
    if (typeof cuerpo === 'object' && cuerpo !== null && 'codigo' in cuerpo) {
      const c = cuerpo as { codigo: string; mensaje?: string; campos?: Record<string, string[]> };
      return {
        codigo: c.codigo,
        mensaje: c.mensaje ?? 'Solicitud invalida.',
        ...(c.campos ? { campos: c.campos } : {}),
      };
    }

    // Excepciones de Nest sin nuestro formato. En produccion se reemplaza el
    // texto: los mensajes por defecto pueden mencionar rutas o propiedades
    // internas.
    const genericos: Record<number, string> = {
      400: 'La solicitud no es valida.',
      401: 'Credenciales invalidas o sesion expirada.',
      403: 'No tienes autorizacion para realizar esta operacion.',
      404: 'No tienes autorizacion para realizar esta operacion.',
      409: 'La operacion entra en conflicto con el estado actual.',
      413: 'El contenido enviado excede el tamano permitido.',
      429: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.',
    };

    const mensaje = this.esProduccion
      ? (genericos[estado] ?? 'Ocurrio un error al procesar la solicitud.')
      : typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo
        ? String((cuerpo as { message: unknown }).message)
        : (genericos[estado] ?? 'Error');

    return { codigo: `HTTP_${estado}`, mensaje };
  }
}
