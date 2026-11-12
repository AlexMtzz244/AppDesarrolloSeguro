import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El cliente no guarda secretos en el navegador (SC-LAB-008, paso 4).
 *
 * El laboratorio guarda un marcador ficticio en `localStorage` para mostrar que
 * cualquier JavaScript del mismo origen lo puede leer. SecureCampus evita el
 * problema de raiz: la sesion vive en una cookie HttpOnly y el cliente nunca
 * ve el token. Esta prueba fija esa decision: si alguien agrega almacenamiento
 * del navegador para otra cosa, tiene que tocar la lista blanca de abajo y
 * justificarlo en la revision.
 */

const RAIZ = join(__dirname, '..');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(nombre) && !/\.spec\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

/** Quita comentarios para que una nota que menciona `localStorage` no cuente como uso. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FUENTES = archivos(RAIZ).map((ruta) => ({
  ruta: relative(RAIZ, ruta).split(sep).join('/'),
  codigo: sinComentarios(readFileSync(ruta, 'utf8')),
}));

/** Preferencias de interfaz: no son datos personales ni dan acceso a nada. */
const USOS_PERMITIDOS: Record<string, readonly string[]> = {
  'componentes/tema.tsx': ['sc-tema'],
  'app/panel/layout.tsx': ['sc-menu-compacto'],
};

describe('almacenamiento del navegador', () => {
  it('solo dos archivos usan localStorage, y para preferencias de interfaz', () => {
    const usan = FUENTES.filter((f) => /\b(localStorage|sessionStorage)\b/.test(f.codigo)).map((f) => f.ruta);
    expect(usan.sort()).toEqual(Object.keys(USOS_PERMITIDOS).sort());

    for (const [ruta, claves] of Object.entries(USOS_PERMITIDOS)) {
      const codigo = FUENTES.find((f) => f.ruta === ruta)!.codigo;
      for (const clave of claves) expect(codigo).toContain(`'${clave}'`);
    }
  });

  it('ninguna clave guardada sugiere una credencial', () => {
    const claves = Object.values(USOS_PERMITIDOS).flat();
    for (const clave of claves) expect(clave).not.toMatch(/token|sesion|session|jwt|clave|password|contrasena/i);
  });

  it('no hay cabecera Authorization, Bearer, document.cookie ni IndexedDB en el cliente', () => {
    const prohibidos = /\b(Authorization|Bearer|indexedDB)\b|document\.cookie/;
    const infractores = FUENTES.filter((f) => prohibidos.test(f.codigo)).map((f) => f.ruta);
    expect(infractores).toEqual([]);
  });

  it('el cliente de la API manda la sesion solo como cookie (credentials: include)', () => {
    const api = FUENTES.find((f) => f.ruta === 'lib/api.ts')!.codigo;
    expect(api).toContain("credentials: 'include'");
    expect(api).not.toMatch(/\bheaders\s*[:=][^;]*(Authorization|Cookie)/i);
  });
});
