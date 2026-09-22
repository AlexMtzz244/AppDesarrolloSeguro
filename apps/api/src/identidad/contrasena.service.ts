import { Inject, Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';

/**
 * Derivacion de contrasenas con Argon2id (RNFS-010).
 *
 * SC-LAB-001 escenario 3 exige "un algoritmo de derivacion lento y adaptable
 * (Argon2id o bcrypt) con salt por usuario". Se elige Argon2id porque resiste
 * tanto ataques por GPU como los que aprovechan poca memoria, y porque sus
 * tres parametros se pueden subir con el tiempo sin cambiar de algoritmo.
 *
 * El salt no aparece en este codigo porque `@node-rs/argon2` lo genera por
 * invocacion y lo incluye en la cadena resultante. Es preferible a generarlo a
 * mano: un salt manual es una oportunidad mas de reutilizarlo por error.
 */
@Injectable()
export class ContrasenaService {
  /**
   * Hash de referencia para el caso de usuario inexistente.
   *
   * Se calcula una vez al arrancar. Sin el, responder a un correo que no
   * existe seria instantaneo y responder a uno que si existe tardaria lo que
   * tarda Argon2 — una diferencia de cientos de milisegundos que basta para
   * enumerar cuentas midiendo tiempos (RNFS-016).
   */
  private hashSenuelo!: string;

  constructor(@Inject(TOKEN_ENTORNO) private readonly entorno: Entorno) {}

  private get opciones() {
    return {
      algorithm: Algorithm.Argon2id,
      memoryCost: this.entorno.ARGON2_MEMORIA_KIB,
      timeCost: this.entorno.ARGON2_ITERACIONES,
      parallelism: this.entorno.ARGON2_PARALELISMO,
    };
  }

  async derivar(contrasena: string): Promise<string> {
    return hash(contrasena, this.opciones);
  }

  async verificar(hashAlmacenado: string, contrasena: string): Promise<boolean> {
    try {
      return await verify(hashAlmacenado, contrasena, this.opciones);
    } catch {
      // Un hash corrupto o de otro algoritmo no debe distinguirse de una
      // contrasena incorrecta.
      return false;
    }
  }

  /**
   * Consume el mismo tiempo que una verificacion real, sin verificar nada.
   *
   * Se invoca cuando el correo no corresponde a ninguna cuenta. Es la mitad
   * del control de no enumeracion: la otra mitad es que el mensaje y el codigo
   * de respuesta tambien sean identicos.
   */
  async verificarSenuelo(contrasena: string): Promise<false> {
    this.hashSenuelo ??= await hash('contrasena-que-no-existe', this.opciones);
    await this.verificar(this.hashSenuelo, contrasena);
    return false;
  }
}
