import { SetMetadata } from '@nestjs/common';
import type { Permiso } from '@securecampus/contracts';
import type { Actor } from './actor.js';
import type { PrismaService } from '../comun/prisma.service.js';

export const CLAVE_POLITICA = 'securecampus:politica';
export const CLAVE_PUBLICO = 'securecampus:publico';

/**
 * Entrada al resolvedor de relacion.
 *
 * Nota que recibe el actor **junto con** los parametros de la ruta. Esa es la
 * decision central del proyecto, expresada como una firma de funcion.
 *
 * SC-LAB-002 §5, decision 1: "El acceso a datos pasa obligatoriamente por una
 * capa que recibe *quien pide* junto con *que pide*; no existe una firma de
 * consulta que acepte solo el identificador... Un desarrollador no puede
 * omitir la verificacion porque el codigo no compila sin el contexto del
 * solicitante."
 */
export interface ContextoRelacion {
  readonly actor: Actor;
  readonly params: Record<string, string>;
  readonly query: Record<string, unknown>;
  readonly body: unknown;
  readonly prisma: PrismaService;
}

/**
 * Resultado de evaluar la relacion entre el actor y el recurso concreto.
 *
 * `motivoTecnico` va al log y a la bitacora, nunca a la respuesta: decirle al
 * cliente "el grupo existe pero no es tuyo" filtra la existencia del recurso
 * (RNFS-006).
 */
export type DecisionRelacion =
  | { readonly permitido: true; readonly recurso?: unknown }
  | { readonly permitido: false; readonly motivoTecnico: string };

export const permitir = (recurso?: unknown): DecisionRelacion => ({
  permitido: true,
  ...(recurso !== undefined ? { recurso } : {}),
});

export const denegar = (motivoTecnico: string): DecisionRelacion => ({
  permitido: false,
  motivoTecnico,
});

export type ResolvedorRelacion = (ctx: ContextoRelacion) => Promise<DecisionRelacion>;

export interface DefinicionPolitica {
  /** Permiso granular por operacion que el actor debe tener (RNFS-004). */
  readonly permiso: Permiso;
  /**
   * Resuelve la relacion actor-recurso contra la base de datos.
   *
   * Es obligatorio salvo en operaciones que no recaen sobre un recurso
   * concreto (por ejemplo, listar lo propio), donde se declara
   * `relacion: 'no-aplica'` de forma explicita. Que haya que escribirlo
   * obliga a pensarlo: el olvido no produce una ruta sin verificacion, produce
   * un error de tipos.
   */
  readonly relacion: ResolvedorRelacion | 'no-aplica';
  /** Exige motivo escrito en el cuerpo, que se guarda en la bitacora. */
  readonly exigeMotivo?: boolean;
  /**
   * Exige segundo factor verificado en la sesion actual. Para las operaciones
   * que reconfiguran el propio modelo de autorizacion.
   */
  readonly exigeMfa?: boolean;
}

/**
 * Declara la politica de un endpoint.
 *
 * Una ruta sin este decorador **responde 403** (RNFS-002). No es una
 * comprobacion que el desarrollador deba recordar: es el comportamiento por
 * omision del guard global, de modo que el olvido falla del lado seguro.
 *
 * SC-LAB-001 §6: "Cada endpoint nuevo es una oportunidad de omitir la
 * verificacion. Se mitiga con *deny by default*: si nadie declaro una regla,
 * la peticion se rechaza, y el olvido falla del lado seguro en lugar de abrir
 * un hueco silencioso."
 */
export const Politica = (definicion: DefinicionPolitica) =>
  SetMetadata(CLAVE_POLITICA, definicion);

/**
 * Marca una ruta como accesible sin sesion.
 *
 * Es la unica excepcion al deny by default, y existe porque el login tiene que
 * ser alcanzable. Se declara igual de explicitamente que una politica: la
 * diferencia con olvidar el decorador es que aqui alguien escribio "esto es
 * publico" y eso aparece en la revision de codigo.
 */
export const Publico = (razon: string) => SetMetadata(CLAVE_PUBLICO, razon);
