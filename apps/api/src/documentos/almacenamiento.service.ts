import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TOKEN_ENTORNO, type Entorno } from '../config/entorno.js';

/**
 * Almacenamiento privado compatible con S3 (RNFS-040, RNFS-041).
 *
 * # Por que existe esta capa
 *
 * SC-LAB-001 escenario 2 describe el problema: los archivos se servian desde
 * `/uploads/constancia_2026_125.pdf`, una ruta publica y predecible. Y su
 * analisis llega a una conclusion que condiciona todo este diseno: "el
 * servidor web entrega el archivo **antes** de que la aplicacion intervenga:
 * no hay ningun punto donde se pueda comprobar la sesion. Por eso el control
 * no es 'agregar una validacion', sino **cambiar la ruta de entrega**".
 *
 * De ahi que el bucket sea privado y que ningun metodo de este servicio genere
 * URLs prefirmadas. Una URL prefirmada es un permiso que viaja por su cuenta:
 * quien la reciba puede reenviarla, y el archivo sale del sistema sin volver a
 * pasar por ninguna verificacion. Todo el contenido se sirve por streaming a
 * traves del endpoint de la API, que autoriza primero.
 *
 * # Claves de objeto
 *
 * Aleatorias y sin relacion con la matricula, el nombre ni el tipo. El nombre
 * original sobrevive solo como metadato en la base.
 */
@Injectable()
export class AlmacenamientoService {
  private readonly logger = new Logger(AlmacenamientoService.name);
  private readonly cliente: S3Client;

  constructor(@Inject(TOKEN_ENTORNO) private readonly entorno: Entorno) {
    this.cliente = new S3Client({
      endpoint: entorno.S3_ENDPOINT,
      region: entorno.S3_REGION,
      forcePathStyle: entorno.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: entorno.S3_ACCESS_KEY_ID,
        secretAccessKey: entorno.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  get bucketCuarentena(): string {
    return this.entorno.S3_BUCKET_CUARENTENA;
  }

  get bucketDocumentos(): string {
    return this.entorno.S3_BUCKET_DOCUMENTOS;
  }

  /**
   * Genera una clave de objeto imposible de adivinar.
   *
   * 32 bytes aleatorios. No lleva matricula, ni nombre de archivo, ni fecha:
   * cualquiera de esos datos daria pie a la adivinacion que el escenario 2
   * describe ("adivinacion de nombres a partir de la matricula").
   *
   * El prefijo por fecha es solo para que el almacen sea navegable por un
   * operador; no aporta informacion sobre el titular.
   */
  generarClave(): string {
    const hoy = new Date();
    const prefijo = `${hoy.getUTCFullYear()}/${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;
    return `${prefijo}/${randomBytes(32).toString('hex')}`;
  }

  async guardar(
    bucket: string,
    clave: string,
    contenido: Buffer,
    tipoMime: string,
  ): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: clave,
        Body: contenido,
        ContentType: tipoMime,
        // Se fija tambien en el objeto: si algun dia se sirviera por otra via,
        // la cabecera viaja con el (RNFS-043).
        ContentDisposition: 'attachment',
      }),
    );
  }

  /**
   * Recupera el contenido como flujo.
   *
   * Solo se invoca DESPUES de que la politica autorizo. El endpoint nunca
   * obtiene el objeto para luego decidir (RNFS-042): si se leyera primero, un
   * fallo posterior en la verificacion ya habria sacado el archivo del
   * almacen, y el coste de la lectura seria ademas una via de abuso.
   */
  async obtener(bucket: string, clave: string): Promise<Readable> {
    const respuesta = await this.cliente.send(
      new GetObjectCommand({ Bucket: bucket, Key: clave }),
    );
    return respuesta.Body as Readable;
  }

  async mover(claveOrigen: string, claveDestino: string, tipoMime: string): Promise<void> {
    const flujo = await this.obtener(this.bucketCuarentena, claveOrigen);
    const trozos: Buffer[] = [];
    for await (const trozo of flujo) trozos.push(Buffer.from(trozo as Buffer));

    await this.guardar(this.bucketDocumentos, claveDestino, Buffer.concat(trozos), tipoMime);
    await this.eliminar(this.bucketCuarentena, claveOrigen);
  }

  async eliminar(bucket: string, clave: string): Promise<void> {
    try {
      await this.cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: clave }));
    } catch (error) {
      // Un objeto huerfano en cuarentena es un problema de limpieza, no de
      // seguridad: el bucket es privado y no hay registro que lo referencie.
      this.logger.warn({ error, bucket, clave }, 'No se pudo eliminar el objeto');
    }
  }
}
