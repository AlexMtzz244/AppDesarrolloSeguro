import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ActorActual, type Actor } from '../autorizacion/actor.js';
import { Politica } from '../autorizacion/politica.decorator.js';
import { soloMiDocumentoOAdministrativo } from '../autorizacion/relaciones.js';
import { ErrorNegocio } from '../comun/excepciones.filter.js';
import { DocumentosService } from './documentos.service.js';

/**
 * Lo que `FileInterceptor` deja en el manejador.
 *
 * Se declara aqui en vez de depender del namespace global de Multer: el tipo
 * global cambia entre versiones de `@types/multer`, y estos tres campos son
 * los unicos que el codigo usa. Notese que `mimetype` es lo que DECLARA el
 * navegador — el servicio lo ignora para decidir y usa magic bytes (RNFS-044).
 */
interface ArchivoSubido {
  readonly buffer: Buffer;
  readonly originalname: string;
  readonly mimetype: string;
}

type DocumentoResuelto = {
  id: string;
  idPublico: string;
  titularId: string;
  claveObjeto: string;
  bucket: string;
  nombreOriginal: string;
  tipoMimeReal: string;
  estadoAntivirus: string;
};

@ApiTags('documentos')
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @Get('mios')
  @Politica({ permiso: 'documento:leer', relacion: 'no-aplica' })
  @ApiOperation({
    summary: 'Documentos del propio usuario (RF-051)',
    description: 'La respuesta nunca incluye la clave de objeto ni el bucket.',
  })
  async mios(@ActorActual() actor: Actor) {
    return this.documentos.misDocumentos(actor);
  }

  @Get('cuota')
  @Politica({ permiso: 'documento:leer', relacion: 'no-aplica' })
  @ApiOperation({ summary: 'Cuota de almacenamiento del usuario (RNFS-045)' })
  async cuota(@ActorActual() actor: Actor) {
    return this.documentos.cuota(actor.usuarioId);
  }

  @Post()
  @Politica({ permiso: 'documento:crear', relacion: 'no-aplica' })
  @UseInterceptors(
    FileInterceptor('archivo', {
      // Tope duro en memoria, ademas del limite por tipo de documento. Sin
      // esto, un archivo enorme consumiria memoria ANTES de que el servicio
      // llegue a rechazarlo por tamano.
      limits: { fileSize: 100 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Sube un documento (RF-050)',
    description:
      'Valida el tipo REAL por magic bytes, no por extension (RNFS-044). ' +
      'El archivo pasa por cuarentena y antivirus antes de estar disponible.',
  })
  async subir(
    @ActorActual() actor: Actor,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Query('tipo') tipo: string,
    @Query('titular') titular?: string,
  ) {
    if (!archivo) {
      throw new ErrorNegocio('ARCHIVO_REQUERIDO', 'No se recibio ningun archivo.');
    }
    if (!tipo) {
      throw new ErrorNegocio('TIPO_REQUERIDO', 'Indica el tipo de documento.');
    }

    return this.documentos.recibir(
      actor,
      {
        buffer: archivo.buffer,
        nombreOriginal: archivo.originalname,
        mimeDeclarado: archivo.mimetype,
      },
      tipo,
      titular,
    );
  }

  /**
   * Descarga mediada por la aplicacion (RF-051, RF-052).
   *
   * El objeto se lee DESPUES de que la politica resolvio la relacion y de que
   * el servicio registro la descarga. Es el cambio de ruta de entrega que
   * SC-LAB-001 escenario 2 identifica como el control real: "mientras el
   * archivo sea alcanzable directamente, cualquier verificacion anadida en la
   * aplicacion es evitable".
   */
  @Get(':id/descargar')
  @Politica({ permiso: 'documento:leer', relacion: soloMiDocumentoOAdministrativo })
  @ApiOperation({
    summary: 'Descarga un documento (RF-051)',
    description:
      'Autoriza antes de obtener el objeto (RNFS-042). Responde con ' +
      'Content-Disposition: attachment y X-Content-Type-Options: nosniff. ' +
      'Las descargas sobre documentos ajenos exigen motivo y quedan auditadas.',
  })
  async descargar(
    @ActorActual() actor: Actor,
    @Req() req: Request & { recurso?: DocumentoResuelto },
    @Param('id') _id: string,
    @Query('motivo') motivo: string | undefined,
    @Res() res: Response,
  ) {
    const { flujo, nombreOriginal, tipoMime } = await this.documentos.prepararDescarga(
      actor,
      req.recurso!,
      motivo,
    );

    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', tipoMime);
    // `attachment` impide que el navegador renderice el contenido, y `nosniff`
    // impide que ignore el Content-Type y lo adivine. Juntos cierran la via de
    // un archivo que se sube como imagen y se interpreta como HTML con script.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanearNombreParaCabecera(nombreOriginal)}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    flujo.pipe(res);
  }
}

/**
 * Limpia el nombre antes de ponerlo en una cabecera HTTP.
 *
 * El nombre original lo eligio quien subio el archivo. Una comilla o un salto
 * de linea sin filtrar permitirian inyectar cabeceras en la respuesta.
 */
function sanearNombreParaCabecera(nombre: string): string {
  return nombre.replace(/[^\w.\- ]/g, '_').slice(0, 120);
}
