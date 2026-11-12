/**
 * Casos HTTP de SC-LAB-007 y SC-LAB-008 contra una API SecureCampus en marcha.
 *
 * Es el equivalente de las experiencias guiadas A-C de SC-LAB-007 y de los
 * pasos 5 y 6 de SC-LAB-008 (`scripts/casos_manuales.py` de SC-LAB-006 hacia lo
 * mismo con el cliente de pruebas de Flask). Cada caso imprime el codigo
 * esperado y el obtenido; el proceso termina con codigo 1 si alguno difiere.
 *
 * Requisitos: base sembrada (`pnpm db:seed`) y la API escuchando en API_URL.
 * Para HTTP local, la API debe arrancar con SESION_COOKIE_SECURE=false: es la
 * misma excepcion que el laboratorio hace con SC_COOKIE_SECURE=0.
 *
 *   pnpm --filter api lab:casos-http
 *
 * Solo desarrollo: crea un grupo ajeno y borra las calificaciones de las dos
 * cuentas de estudiante en el grupo sembrado para poder repetirse.
 */
import { PrismaClient } from '@prisma/client';
import { ulid } from 'ulid';

const API = process.env['API_URL'] ?? 'http://localhost:3001';
const ORIGEN_WEB = process.env['ORIGEN_WEB'] ?? 'http://localhost:3000';
const ORIGEN_ATACANTE = 'https://sitio-malicioso.example';
// Contrasena documentada de las cuentas sembradas (README, "Cuentas de desarrollo").
const CONTRASENA = process.env['CASOS_CONTRASENA'] ?? 'SemillaDesarrollo!2026';

const CORREO = {
  profesor: 'profesor@securecampus.edu.mx',
  eli: 'estudiante.a@securecampus.edu.mx',
  paz: 'estudiante.b@securecampus.edu.mx',
} as const;

const prisma = new PrismaClient();
let fallos = 0;

interface Respuesta {
  estado: number;
  cuerpo: unknown;
  cookies: string[];
}

async function http(
  metodo: string,
  ruta: string,
  opciones: { cookie?: string; origen?: string; cuerpo?: unknown } = {},
): Promise<Respuesta> {
  const cabeceras: Record<string, string> = {};
  if (opciones.cookie) cabeceras['Cookie'] = opciones.cookie;
  if (opciones.origen) cabeceras['Origin'] = opciones.origen;
  if (opciones.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: opciones.cuerpo === undefined ? null : JSON.stringify(opciones.cuerpo),
    redirect: 'manual',
  });
  const texto = await r.text();
  let cuerpo: unknown = texto;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    /* no era JSON */
  }
  return { estado: r.status, cuerpo, cookies: r.headers.getSetCookie() };
}

async function iniciarSesion(correo: string): Promise<{ cookie: string; token: string; completa: string }> {
  const r = await http('POST', '/api/auth/login', {
    origen: ORIGEN_WEB,
    cuerpo: { correo, contrasena: CONTRASENA },
  });
  const completa = r.cookies.find((c) => c.startsWith('sc_sesion='));
  if (r.estado !== 200 || !completa) {
    throw new Error(`No se pudo iniciar sesion como ${correo}: HTTP ${r.estado} ${JSON.stringify(r.cuerpo)}`);
  }
  const par = completa.split(';')[0]!;
  return { cookie: par, token: par.split('=')[1]!, completa };
}

function caso(id: string, descripcion: string, esperado: number, obtenido: number): void {
  const ok = esperado === obtenido;
  if (!ok) fallos += 1;
  console.log(`${ok ? 'OK  ' : 'FALLA'}  ${id.padEnd(3)} ${descripcion.padEnd(66)} esperado ${esperado}  obtenido ${obtenido}`);
}

function comprobar(id: string, descripcion: string, condicion: boolean): void {
  if (!condicion) fallos += 1;
  console.log(`${condicion ? 'OK  ' : 'FALLA'}  ${id.padEnd(3)} ${descripcion}`);
}

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') throw new Error('Este script es solo de desarrollo.');

  // --- Escenario ------------------------------------------------------------
  const propio = await prisma.grupo.findFirstOrThrow({
    where: { clave: 'ISC-601-A' },
    select: { id: true, idPublico: true, periodoId: true, programaId: true, materiaId: true },
  });
  const aula = await prisma.aula.upsert({
    where: { clave: 'A-AJENO' },
    create: { idPublico: ulid(), clave: 'A-AJENO', edificio: 'A', capacidad: 30 },
    update: {},
  });
  const ajeno = await prisma.grupo.upsert({
    where: { clave_periodoId: { clave: 'ISC-601-B', periodoId: propio.periodoId } },
    create: {
      idPublico: ulid(),
      clave: 'ISC-601-B',
      programaId: propio.programaId,
      materiaId: propio.materiaId,
      periodoId: propio.periodoId,
      aulaId: aula.id,
      cupo: 30,
    },
    update: {},
    select: { id: true, idPublico: true },
  });

  const eli = await prisma.usuario.findUniqueOrThrow({ where: { correo: CORREO.eli }, select: { id: true, idPublico: true } });
  const paz = await prisma.usuario.findUniqueOrThrow({ where: { correo: CORREO.paz }, select: { id: true, idPublico: true } });

  // Para poder repetir el script: sin calificaciones previas en el grupo propio.
  const previas = await prisma.calificacion.findMany({ where: { grupoId: propio.id }, select: { id: true } });
  await prisma.versionCalificacion.deleteMany({ where: { calificacionId: { in: previas.map((p) => p.id) } } });
  await prisma.calificacion.deleteMany({ where: { grupoId: propio.id } });

  console.log(`API:           ${API}  (esquema ${new URL(API).protocol}, solo valido en localhost)`);
  console.log(`Grupo propio:  ${propio.idPublico}  (profesor asignado)`);
  console.log(`Grupo ajeno:   ${ajeno.idPublico}  (el profesor NO esta asignado)\n`);

  const captura = (cookie: string | undefined, grupo: string, estudiante: string, valor: unknown, origen?: string) =>
    http('POST', '/api/calificaciones/captura', {
      ...(cookie ? { cookie } : {}),
      ...(origen ? { origen } : {}),
      cuerpo: { grupoId: grupo, calificaciones: [{ estudianteId: estudiante, valor }] },
    });
  const valorGuardado = async (estudianteId: string) =>
    (await prisma.calificacion.findFirst({ where: { grupoId: propio.id, estudianteId } }))?.valor.toString() ?? null;

  // --- A. Consulta (GET): misma sesion, distinto recurso --------------------
  console.log('A. Profesor: consulta de grupos');
  const profe = await iniciarSesion(CORREO.profesor);
  caso('A1', 'GET lista del grupo PROPIO', 200, (await http('GET', `/api/calificaciones/grupo/${propio.idPublico}`, { cookie: profe.cookie })).estado);
  caso('A2', 'GET lista del grupo AJENO (misma sesion)', 403, (await http('GET', `/api/calificaciones/grupo/${ajeno.idPublico}`, { cookie: profe.cookie })).estado);
  caso('A3', 'GET sin sesion', 401, (await http('GET', `/api/calificaciones/grupo/${propio.idPublico}`)).estado);

  // --- B. Modificacion (POST captura): 201 / 403 / 400 / 401 ----------------
  console.log('\nB. Profesor: captura de calificaciones');
  caso('B1', 'captura 88.50 a la alumna inscrita (grupo propio)', 201, (await captura(profe.cookie, propio.idPublico, eli.idPublico, 88.5)).estado);
  comprobar('B1', `valor guardado: ${await valorGuardado(eli.id)} (se espera 88.5, sin redondeo)`, (await valorGuardado(eli.id)) === '88.5');
  caso('B2', 'captura en el grupo AJENO', 403, (await captura(profe.cookie, ajeno.idPublico, paz.idPublico, 88.5)).estado);
  caso('B3', 'captura con valor 150 (fuera de rango)', 400, (await captura(profe.cookie, propio.idPublico, eli.idPublico, 150)).estado);
  caso('B4', 'captura con valor "1e2" (notacion cientifica como texto)', 400, (await captura(profe.cookie, propio.idPublico, eli.idPublico, '1e2')).estado);
  caso('B5', 'captura sin sesion', 401, (await captura(undefined, propio.idPublico, eli.idPublico, 88.5)).estado);
  comprobar('B6', `tras los rechazos el valor sigue en ${await valorGuardado(eli.id)} (se espera 88.5)`, (await valorGuardado(eli.id)) === '88.5');

  // --- C. CSRF: el PUT del laboratorio exige X-CSRF-Token; aqui, origen -----
  // Se prueba ANTES de publicar: mientras la nota es borrador un cambio
  // indebido seria visible en el valor guardado.
  console.log('\nC. Peticiones desde otro origen (CSRF)');
  const alumna = await iniciarSesion(CORREO.eli);
  const antes = await valorGuardado(eli.id);
  caso('C1', 'captura con sesion valida pero Origin ajeno', 403,
    (await captura(profe.cookie, propio.idPublico, eli.idPublico, 91, ORIGEN_ATACANTE)).estado);
  comprobar('C1', `valor guardado: ${await valorGuardado(eli.id)} (sin cambios respecto a ${antes})`, (await valorGuardado(eli.id)) === antes);
  const loginAjeno = await http('POST', '/api/auth/login', { origen: ORIGEN_ATACANTE, cuerpo: { correo: CORREO.eli, contrasena: CONTRASENA } });
  caso('C2', 'inicio de sesion desde Origin ajeno', 403, loginAjeno.estado);
  comprobar('C2', 'no se emitio cookie de sesion', loginAjeno.cookies.length === 0);
  caso('C3', 'cierre de sesion de la alumna desde Origin ajeno', 403,
    (await http('POST', '/api/auth/logout', { cookie: alumna.cookie, origen: ORIGEN_ATACANTE })).estado);
  caso('C4', 'la sesion de la alumna sigue viva tras el intento', 200, (await http('GET', '/api/auth/yo', { cookie: alumna.cookie })).estado);

  // --- D. Estudiante: ser duena de la nota no autoriza a cambiarla ----------
  console.log('\nD. Alumna: control de acceso');
  // Paz tambien tiene nota, capturada por el profesor, para poder leerla despues.
  await captura(profe.cookie, propio.idPublico, paz.idPublico, 70);
  const filas = await prisma.calificacion.findMany({ where: { grupoId: propio.id }, select: { idPublico: true, estudianteId: true } });
  const idEli = filas.find((f) => f.estudianteId === eli.id)!.idPublico;
  const idPaz = filas.find((f) => f.estudianteId === paz.id)!.idPublico;
  caso('D0', 'el profesor publica las calificaciones del grupo propio', 201,
    (await http('POST', '/api/calificaciones/publicar', { cookie: profe.cookie, cuerpo: { grupoId: propio.idPublico, calificacionIds: [idEli, idPaz] } })).estado);
  caso('D1', 'GET de su propia calificacion', 200, (await http('GET', `/api/calificaciones/${idEli}/historial`, { cookie: alumna.cookie })).estado);
  caso('D2', 'GET de la calificacion de otra persona (cambiando el id)', 403, (await http('GET', `/api/calificaciones/${idPaz}/historial`, { cookie: alumna.cookie })).estado);
  caso('D3', 'intento de modificar la propia calificacion', 403, (await captura(alumna.cookie, propio.idPublico, eli.idPublico, 100)).estado);
  comprobar('D3', `valor guardado: ${await valorGuardado(eli.id)} (se espera 88.5)`, (await valorGuardado(eli.id)) === '88.5');

  // --- E. Sesion del cliente: cookie, no almacenamiento ---------------------
  console.log('\nE. Sesion del cliente (SC-LAB-008)');
  const atributos = alumna.completa.split(';').slice(1).map((a) => a.trim().split('=')[0]!.toLowerCase());
  console.log(`      Set-Cookie: sc_sesion=<${alumna.token.length} caracteres, no se imprime>; ${atributos.join('; ')}`);
  comprobar('E1', 'la cookie es HttpOnly', atributos.includes('httponly'));
  comprobar('E2', 'la cookie lleva SameSite', atributos.includes('samesite'));
  comprobar('E3', 'la cookie lleva Path=/', atributos.includes('path'));
  console.log(`      Secure: ${atributos.includes('secure') ? 'presente' : 'ausente (SESION_COOKIE_SECURE=false, solo para HTTP en localhost)'}`);
  const yo = await http('GET', '/api/auth/yo', { cookie: alumna.cookie });
  comprobar('E4', 'el token de sesion no aparece en el cuerpo de /auth/yo', !JSON.stringify(yo.cuerpo).includes(alumna.token));
  const sinSesion = await http('GET', '/api/auth/yo');
  caso('E5', 'sin cookie, la API no identifica a nadie', 401, sinSesion.estado);

  console.log(`\n${fallos === 0 ? 'Todos los casos coinciden.' : `${fallos} caso(s) no coinciden.`}`);
}

main()
  .catch((e) => {
    console.error(e);
    fallos += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(fallos === 0 ? 0 : 1);
  });
