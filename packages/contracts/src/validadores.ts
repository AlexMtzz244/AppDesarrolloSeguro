/**
 * Validadores estrictos de calificacion (patron de SC-LAB-006, `validators.py`).
 *
 * Regla del laboratorio: un valor invalido se **rechaza**, nunca se corrige.
 * La columna es `Decimal(5,2)`; si llegara `99.999` o `1e-7`, la base lo
 * redondearia en silencio y quedaria registrada una nota que nadie capturo.
 *
 * Todo se decide sobre la representacion textual y no con aritmetica de
 * flotantes: `Math.round(n * 100) === n * 100` da falso para `0.07`, y
 * `multipleOf(0.01)` de Zod deja pasar `1e-7`.
 */

const FORMATO_DECIMAL = /^\d+(\.\d{1,2})?$/;
const FORMATO_TEXTO = /^\d{1,3}(\.\d{1,2})?$/;

/**
 * `true` si el numero se escribe con a lo sumo dos decimales.
 *
 * `String(1e-7)` es `"1e-7"` y no cumple el formato, por lo que se rechaza;
 * `String(0.07)` es `"0.07"` y se acepta.
 */
export function tieneMaximoDosDecimales(n: number): boolean {
  return Number.isFinite(n) && FORMATO_DECIMAL.test(String(n));
}

export type ResultadoCalificacionTexto =
  | { readonly ok: true; readonly valor: number }
  | { readonly ok: false; readonly mensaje: string };

/**
 * Interpreta lo que un usuario escribio en un campo de calificacion.
 *
 * Solo digitos con punto decimal opcional: `0x10`, `1e1`, `NaN`, `Infinity`,
 * signos y separadores de miles no son notas validas aunque `Number()` los
 * acepte. Cada causa produce un mensaje distinto.
 */
export function parsearCalificacionTexto(texto: string): ResultadoCalificacionTexto {
  const limpio = texto.trim();

  if (limpio === '') {
    return { ok: false, mensaje: 'La calificacion es obligatoria.' };
  }
  if (/^-/.test(limpio)) {
    return { ok: false, mensaje: 'La calificacion no puede ser negativa.' };
  }
  if (/^\d+\.\d{3,}$/.test(limpio)) {
    return { ok: false, mensaje: 'La calificacion admite maximo 2 decimales.' };
  }
  if (!FORMATO_TEXTO.test(limpio)) {
    return { ok: false, mensaje: 'La calificacion debe ser un numero valido.' };
  }

  const valor = Number(limpio);
  if (valor > 100) {
    return { ok: false, mensaje: 'La calificacion debe estar entre 0 y 100.' };
  }
  return { ok: true, valor };
}
