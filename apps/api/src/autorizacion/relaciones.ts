import type { ContextoRelacion, DecisionRelacion, ResolvedorRelacion } from './politica.decorator.js';
import { denegar, permitir } from './politica.decorator.js';

/**
 * Resolvedores de relacion actor-recurso.
 *
 * Este archivo es la respuesta concreta a la observacion que atraviesa
 * SC-LAB-001 (§1): "en los cuatro roles el alcance no esta definido por el rol
 * solamente, sino por la relacion entre el usuario y el recurso concreto (mi
 * perfil, mi grupo, mi documento). Un sistema que verifique unicamente el rol
 * y no esa relacion quedara expuesto, aunque la autenticacion funcione
 * perfectamente."
 *
 * Cada funcion de aqui responde a *una* pregunta de relacion y la resuelve
 * contra la base de datos, con el actor como parametro obligatorio. Ninguna
 * acepta un identificador suelto.
 */

// ---------------------------------------------------------------------------
// Propiedad directa
// ---------------------------------------------------------------------------

/**
 * El recurso solicitado es el propio perfil del actor.
 *
 * Es el caso de Maria de SC-LAB-001 §3, resuelto: el identificador de la ruta
 * se compara contra el de la sesion, y si no coinciden se deniega **sin**
 * consultar el registro ajeno. No se lee para despues decidir; se decide antes
 * de leer.
 */
export const soloMiPerfil: ResolvedorRelacion = async ({ actor, params }) => {
  const solicitado = params['id'];
  if (!solicitado) return denegar('sin-identificador');
  // `me` es azucar para la propia cuenta; evita que el cliente tenga que
  // conocer su identificador para pedir lo suyo.
  if (solicitado === 'me' || solicitado === actor.idPublico) return permitir();
  return denegar('perfil-ajeno');
};

/**
 * El actor es el titular del documento, o tiene permiso administrativo.
 *
 * La segunda via exige motivo (RF-052) y lo registra. Que el administrador
 * pueda descargar no lo hace invisible: el punto del control no es impedirle
 * su funcion, es que quede constancia de cada vez que la usa.
 */
export const soloMiDocumentoOAdministrativo: ResolvedorRelacion = async ({
  actor,
  params,
  prisma,
}) => {
  const idPublico = params['id'];
  if (!idPublico) return denegar('sin-identificador');

  const documento = await prisma.documento.findFirst({
    where: { idPublico, eliminadoEl: null },
    select: {
      id: true,
      idPublico: true,
      titularId: true,
      claveObjeto: true,
      bucket: true,
      nombreOriginal: true,
      tipoMimeReal: true,
      tamanoBytes: true,
      estadoAntivirus: true,
    },
  });

  // Documento inexistente y documento ajeno producen la MISMA denegacion
  // (RNFS-006). Si el inexistente devolviera 404 y el ajeno 403, recorrer
  // identificadores revelaria cuales existen.
  if (!documento) return denegar('documento-inexistente');

  if (documento.titularId === actor.usuarioId) {
    return permitir(documento);
  }

  if (actor.permisos.has('documento:leer') && actor.permisos.has('usuario:leer')) {
    return permitir(documento);
  }

  return denegar('documento-ajeno');
};

export const soloMiSolicitud: ResolvedorRelacion = async ({ actor, params, prisma }) => {
  const idPublico = params['id'];
  if (!idPublico) return denegar('sin-identificador');

  const solicitud = await prisma.solicitud.findUnique({
    where: { idPublico },
    select: { id: true, idPublico: true, titularId: true, estadoId: true, tipoSolicitudId: true },
  });

  if (!solicitud) return denegar('solicitud-inexistente');
  if (solicitud.titularId === actor.usuarioId) return permitir(solicitud);
  if (actor.permisos.has('solicitud:modificar')) return permitir(solicitud);
  return denegar('solicitud-ajena');
};

// ---------------------------------------------------------------------------
// Adscripcion a programa — el alcance del jefe de carrera
// ---------------------------------------------------------------------------

/**
 * El grupo pertenece al programa del actor.
 *
 * Cierra la vulnerabilidad (c) del escenario 5 de SC-LAB-001: "el rol de jefe
 * se trata como global: cualquier jefe puede tocar grupos de cualquier
 * carrera, no solo de la suya".
 *
 * El programa sale de `actor.programaId`, que viene del perfil en la base de
 * datos. Nunca del cuerpo de la peticion — si viajara en el formulario,
 * cambiar un campo bastaria para alcanzar otro programa.
 */
export const grupoDeMiPrograma: ResolvedorRelacion = async ({ actor, params, prisma }) => {
  if (!actor.programaId) return denegar('actor-sin-programa');

  const idPublico = params['id'] ?? params['grupoId'];
  if (!idPublico) return denegar('sin-identificador');

  const grupo = await prisma.grupo.findUnique({
    where: { idPublico },
    select: {
      id: true,
      idPublico: true,
      programaId: true,
      periodoId: true,
      periodo: { select: { estado: true, id: true } },
    },
  });

  if (!grupo) return denegar('grupo-inexistente');
  if (grupo.programaId !== actor.programaId) return denegar('grupo-de-otro-programa');
  return permitir(grupo);
};

/**
 * Igual que el anterior, pero ademas exige que el periodo este abierto.
 *
 * Se separa en dos resolvedores en vez de un parametro booleano porque son dos
 * decisiones distintas: consultar un grupo de un periodo cerrado es legitimo,
 * modificarlo no. Un solo resolvedor con bandera invita a pasar `false` por
 * comodidad (RF-033).
 */
export const grupoDeMiProgramaEnPeriodoAbierto: ResolvedorRelacion = async (ctx) => {
  const decision = await grupoDeMiPrograma(ctx);
  if (!decision.permitido) return decision;

  const grupo = decision.recurso as { periodo: { estado: string } };
  if (grupo.periodo.estado !== 'abierto') {
    return denegar('periodo-cerrado');
  }
  return decision;
};

/** El programa indicado es el de adscripcion del actor. */
export const miPrograma: ResolvedorRelacion = async ({ actor, params, prisma }) => {
  if (!actor.programaId) return denegar('actor-sin-programa');
  const idPublico = params['id'];
  if (!idPublico) return denegar('sin-identificador');

  const programa = await prisma.programa.findUnique({
    where: { idPublico },
    select: { id: true, idPublico: true },
  });

  if (!programa) return denegar('programa-inexistente');
  if (programa.id !== actor.programaId) return denegar('programa-ajeno');
  return permitir(programa);
};

// ---------------------------------------------------------------------------
// Asignacion docente vigente — el control central de calificaciones
// ---------------------------------------------------------------------------

/**
 * El actor tiene asignacion docente **vigente** sobre el grupo y el periodo
 * esta abierto.
 *
 * Es el control principal del escenario 1 de SC-LAB-001: "validar en el
 * servidor, en cada operacion de escritura, que el grupo pertenece a la
 * asignacion vigente del profesor en el periodo en curso".
 *
 * Con una salvedad que el mismo laboratorio hace explicita y que conviene no
 * perder de vista al leer este codigo: **este control no se sostiene solo**.
 * Descansa por completo en que el registro de asignacion sea integro, y ese
 * registro lo produce el jefe de carrera. Si alguien puede alterarlo, esta
 * funcion seguira respondiendo "si, autorizado" y el control quedara
 * neutralizado sin haber sido vulnerado tecnicamente.
 *
 * Por eso la asignacion se versiona (nunca se sobrescribe) y por eso existen
 * las alertas `captura-inmediata-tras-asignacion` y
 * `asignacion-revertida-pronto`. La prevencion de aqui y la deteccion de alla
 * son un solo control repartido.
 */
export const grupoAsignadoVigente: ResolvedorRelacion = async ({ actor, params, body, prisma }) => {
  const idPublico =
    params['grupoId'] ??
    params['id'] ??
    (typeof body === 'object' && body !== null && 'grupoId' in body
      ? String((body as { grupoId: unknown }).grupoId)
      : undefined);

  if (!idPublico) return denegar('sin-identificador-de-grupo');

  const ahora = new Date();

  const grupo = await prisma.grupo.findUnique({
    where: { idPublico },
    select: {
      id: true,
      idPublico: true,
      periodoId: true,
      periodo: { select: { estado: true, inicia: true, termina: true } },
      asignaciones: {
        where: {
          profesorId: actor.usuarioId,
          desdeEl: { lte: ahora },
          OR: [{ hastaEl: null }, { hastaEl: { gt: ahora } }],
        },
        select: { id: true, idPublico: true, version: true, desdeEl: true },
        take: 1,
      },
    },
  });

  if (!grupo) return denegar('grupo-inexistente');

  // Nota el orden: primero la relacion, despues el estado del periodo. Un
  // profesor ajeno no debe poder distinguir "no es tuyo" de "esta cerrado";
  // ambas respuestas son identicas hacia afuera, pero el motivo tecnico que
  // llega a la bitacora si las separa, y eso es lo que permite investigar.
  if (grupo.asignaciones.length === 0) return denegar('sin-asignacion-vigente');
  if (grupo.periodo.estado !== 'abierto') return denegar('periodo-cerrado');

  return permitir({ grupo, asignacion: grupo.asignaciones[0] });
};

/**
 * Lectura de calificaciones: el actor es el estudiante titular, o el profesor
 * con asignacion vigente sobre el grupo.
 *
 * A diferencia del anterior, aqui **no** se exige periodo abierto: consultar
 * una calificacion de un semestre cerrado es legitimo para ambos. La
 * restriccion temporal aplica a la escritura, no a la lectura.
 */
export const calificacionVisible: ResolvedorRelacion = async ({ actor, params, prisma }) => {
  const idPublico = params['id'];
  if (!idPublico) return denegar('sin-identificador');

  const calificacion = await prisma.calificacion.findUnique({
    where: { idPublico },
    select: {
      id: true,
      idPublico: true,
      estudianteId: true,
      grupoId: true,
      estado: true,
      valor: true,
      versionActual: true,
    },
  });

  if (!calificacion) return denegar('calificacion-inexistente');

  if (calificacion.estudianteId === actor.usuarioId) {
    // El estudiante no ve sus calificaciones en borrador: todavia no son un
    // hecho, y mostrarlas convertiria cada captura tentativa en una
    // comunicacion oficial.
    if (calificacion.estado === 'borrador') return denegar('calificacion-en-borrador');
    return permitir(calificacion);
  }

  const ahora = new Date();
  const asignacion = await prisma.asignacionDocente.findFirst({
    where: {
      grupoId: calificacion.grupoId,
      profesorId: actor.usuarioId,
      desdeEl: { lte: ahora },
      OR: [{ hastaEl: null }, { hastaEl: { gt: ahora } }],
    },
    select: { id: true },
  });

  if (asignacion) return permitir(calificacion);
  return denegar('calificacion-ajena');
};

/**
 * Correccion de una calificacion publicada (RF-044).
 *
 * Deliberadamente **no** verifica asignacion docente: corregir es una
 * operacion administrativa con permiso propio (`calificacion:corregir`), que
 * por la separacion de funciones de RNFS-007 no coexiste con
 * `calificacion:crear`. Quien captura no corrige, y quien corrige no captura.
 */
export const calificacionPublicadaCorregible: ResolvedorRelacion = async ({
  params,
  prisma,
}) => {
  const idPublico = params['id'];
  if (!idPublico) return denegar('sin-identificador');

  const calificacion = await prisma.calificacion.findUnique({
    where: { idPublico },
    select: {
      id: true,
      idPublico: true,
      estado: true,
      valor: true,
      versionActual: true,
      estudianteId: true,
      grupoId: true,
    },
  });

  if (!calificacion) return denegar('calificacion-inexistente');

  // Una calificacion en borrador no se "corrige": se edita por el flujo
  // ordinario. Admitirlo aqui permitiria saltarse la maquina de estados por
  // la puerta de atras.
  if (calificacion.estado === 'borrador') return denegar('calificacion-en-borrador');

  return permitir(calificacion);
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Combina resolvedores con logica de disyuncion: basta que uno permita.
 *
 * Devuelve el motivo tecnico de *todos* los que denegaron, porque al
 * investigar interesa saber por que ninguna via funciono, no solo la ultima.
 */
export function alguno(...resolvedores: ResolvedorRelacion[]): ResolvedorRelacion {
  return async (ctx: ContextoRelacion): Promise<DecisionRelacion> => {
    const motivos: string[] = [];
    for (const resolvedor of resolvedores) {
      const decision = await resolvedor(ctx);
      if (decision.permitido) return decision;
      motivos.push(decision.motivoTecnico);
    }
    return denegar(motivos.join('|'));
  };
}
