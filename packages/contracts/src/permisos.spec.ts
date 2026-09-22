import { describe, expect, it } from 'vitest';
import {
  ES_PERMISO,
  PARES_INCOMPATIBLES,
  PERMISOS,
  detectarConflictosSeparacion,
} from './permisos.js';
import { esquemaMotivo, esquemaId } from './comunes.js';
import { transicionPermitida } from './calificaciones.js';
import { documentoEsEntregable } from './documentos.js';

/**
 * Pruebas de las funciones puras del vocabulario compartido.
 *
 * Viven aqui, en el paquete que las define, y no solo en la API, porque son
 * reglas de dominio que ambos lados consumen: si `transicionPermitida` se
 * rompiera, la pantalla del profesor ofreceria acciones que el servidor
 * rechaza.
 */

describe('catalogo de permisos', () => {
  it('no tiene duplicados', () => {
    expect(new Set(PERMISOS).size).toBe(PERMISOS.length);
  });

  it('todos siguen el formato recurso:operacion', () => {
    for (const permiso of PERMISOS) {
      expect(permiso, `Formato invalido: ${permiso}`).toMatch(/^[a-z-]+:[a-z-]+$/);
    }
  });

  it('ES_PERMISO rechaza claves inventadas', () => {
    expect(ES_PERMISO('perfil:leer')).toBe(true);
    // Una clave escrita a mano en la base no debe otorgar nada.
    expect(ES_PERMISO('usuario:todo')).toBe(false);
    expect(ES_PERMISO('')).toBe(false);
  });
});

describe('separacion de funciones', () => {
  it('detecta cada par incompatible declarado', () => {
    for (const [a, b] of PARES_INCOMPATIBLES) {
      expect(detectarConflictosSeparacion([a, b]), `${a} + ${b}`).toHaveLength(1);
    }
  });

  it('no marca un permiso aislado', () => {
    for (const [a] of PARES_INCOMPATIBLES) {
      expect(detectarConflictosSeparacion([a])).toEqual([]);
    }
  });

  it('el orden de los permisos no altera el resultado', () => {
    const par = PARES_INCOMPATIBLES[0]!;
    expect(detectarConflictosSeparacion([par[0], par[1]])).toEqual(
      detectarConflictosSeparacion([par[1], par[0]]),
    );
  });
});

describe('maquina de estados de calificaciones', () => {
  it('una calificacion publicada NO vuelve a borrador', () => {
    // Es la transicion que el flujo ordinario de captura intentaria, y la que
    // convertiria la correccion auditada en opcional.
    expect(transicionPermitida('publicado', 'borrador')).toBe(false);
  });

  it('la unica salida de publicado es corregido', () => {
    expect(transicionPermitida('publicado', 'corregido')).toBe(true);
    expect(transicionPermitida('publicado', 'publicado')).toBe(false);
  });

  it('corregido no retrocede', () => {
    expect(transicionPermitida('corregido', 'borrador')).toBe(false);
    expect(transicionPermitida('corregido', 'publicado')).toBe(false);
  });
});

describe('entrega de documentos', () => {
  it('solo un documento limpio se entrega', () => {
    expect(documentoEsEntregable('limpio')).toBe(true);
  });

  it('un fallo del antivirus NO cuenta como limpio', () => {
    // Deny by default aplicado al contenido: si el analisis no pudo
    // pronunciarse, el archivo se queda retenido.
    expect(documentoEsEntregable('error-analisis')).toBe(false);
    expect(documentoEsEntregable('pendiente')).toBe(false);
    expect(documentoEsEntregable('en-cuarentena')).toBe(false);
    expect(documentoEsEntregable('infectado')).toBe(false);
  });
});

describe('esquemas transversales', () => {
  it('el motivo rechaza texto simbolico', () => {
    // Un campo que acepta "x" es un campo que nadie llena, y una bitacora
    // llena de motivos vacios no permite reconstruir nada.
    expect(esquemaMotivo.safeParse('x').success).toBe(false);
    expect(esquemaMotivo.safeParse('   ').success).toBe(false);
    expect(esquemaMotivo.safeParse('Correccion por error de captura').success).toBe(true);
  });

  it('el identificador publico solo acepta ULID', () => {
    expect(esquemaId.safeParse('01ARZ3NDEKTSV4RRFFQ69G5FAV').success).toBe(true);
    // Un identificador secuencial no es representable: es defensa en
    // profundidad contra la enumeracion del caso de Maria.
    expect(esquemaId.safeParse('126').success).toBe(false);
    expect(esquemaId.safeParse("1 OR '1'='1").success).toBe(false);
  });
});
