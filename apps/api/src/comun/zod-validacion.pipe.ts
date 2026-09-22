import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { ZodError, type ZodSchema } from 'zod';
import { ErrorNegocio } from './excepciones.filter.js';

/**
 * Valida el cuerpo, los parametros o la query con un esquema de
 * `@securecampus/contracts`.
 *
 * Dos propiedades importan y no son obvias:
 *
 * 1. **Devuelve el dato parseado, no el original.** Zod descarta las claves no
 *    declaradas, de modo que un campo extra enviado por el cliente
 *    —`rol`, `titularId`, `estado`— nunca llega al servicio. Es la defensa
 *    estructural contra *mass assignment*: no hay que acordarse de filtrar,
 *    porque lo que no se declaro no existe rio abajo.
 *
 * 2. **Es el mismo esquema que usa el navegador.** Compartirlo evita que
 *    cliente y servidor diverjan, pero no sustituye esta validacion: lo que el
 *    navegador comprueba es cortesia con el usuario, lo que comprueba el
 *    servidor es el control (RNFS-001).
 */
export class ZodValidacionPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly esquema: ZodSchema<T>) {}

  transform(valor: unknown): T {
    const resultado = this.esquema.safeParse(valor);
    if (resultado.success) return resultado.data;

    throw new ErrorNegocio(
      'VALIDACION',
      'Revisa los datos enviados.',
      HttpStatus.BAD_REQUEST,
      agruparPorCampo(resultado.error),
    );
  }
}

function agruparPorCampo(error: ZodError): Record<string, string[]> {
  const campos: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const clave = issue.path.join('.') || '_';
    (campos[clave] ??= []).push(issue.message);
  }
  return campos;
}

/** Azucar para usarlo en un decorador de parametro. */
export const validar = <T>(esquema: ZodSchema<T>) => new ZodValidacionPipe(esquema);
