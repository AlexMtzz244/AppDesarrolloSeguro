import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { middlewareCorrelacion } from './comun/correlacion.js';
import { FiltroExcepciones } from './comun/excepciones.filter.js';
import { cargarEntorno } from './config/entorno.js';

async function arrancar(): Promise<void> {
  // Se valida ANTES de construir la aplicacion. Si falta una variable critica,
  // el proceso termina aqui y no deja un servicio a medias respondiendo
  // peticiones con una clave de cifrado ausente (RNFS-052).
  const entorno = cargarEntorno();
  const esProduccion = entorno.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    logger: esProduccion ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug'],
  });

  // --- Cabeceras de seguridad (RNFS-051) ---------------------------------
  app.use(
    helmet({
      // HSTS solo en produccion: en desarrollo forzaria HTTPS en localhost y
      // dejaria el navegador con la politica fijada durante meses.
      hsts: esProduccion
        ? { maxAge: 63_072_000, includeSubDomains: true, preload: true }
        : false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      // Sin esto, un navegador puede interpretar como HTML un archivo servido
      // con otro tipo, que es la mitad del riesgo de las subidas (RNFS-043).
      noSniff: true,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  // Oculta `X-Powered-By`. No es un control real, pero tampoco hay motivo para
  // anunciar la version del stack.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Numero de proxies de confianza. Sin esto la IP real se pierde y el limite
  // por origen es inutil (SC-LAB-002 escenario D, fase Despliegue).
  app.getHttpAdapter().getInstance().set('trust proxy', entorno.TRUST_PROXY_SALTOS);

  app.use(cookieParser());
  app.use(middlewareCorrelacion(entorno.TRUST_PROXY_SALTOS));

  // --- CORS por lista blanca ---------------------------------------------
  app.enableCors({
    origin: entorno.CORS_ORIGENES_PERMITIDOS,
    // La sesion viaja en cookie, asi que el navegador necesita permiso
    // explicito para enviarla entre origenes.
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Correlation-Id'],
    maxAge: 600,
  });

  app.useGlobalFilters(new FiltroExcepciones(esProduccion));
  app.setGlobalPrefix('api');

  // --- OpenAPI ------------------------------------------------------------
  // Se publica solo fuera de produccion. El esquema describe cada endpoint,
  // sus parametros y sus codigos de error: es un mapa util para quien
  // desarrolla y tambien para quien busca superficie de ataque.
  if (!esProduccion) {
    const config = new DocumentBuilder()
      .setTitle('SecureCampus API')
      .setDescription(
        'Plataforma academica segura. Cada endpoint declara su politica de ' +
          'autorizacion; una ruta sin politica responde 403 (RNFS-002).',
      )
      .setVersion('0.1.0')
      .addCookieAuth(entorno.SESION_COOKIE_NOMBRE)
      .build();

    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config), {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.enableShutdownHooks();

  await app.listen(entorno.API_PUERTO, '0.0.0.0');

  const logger = new Logger('Arranque');
  logger.log(`SecureCampus API escuchando en el puerto ${entorno.API_PUERTO}`);
  if (!esProduccion) {
    logger.log(`OpenAPI disponible en http://localhost:${entorno.API_PUERTO}/api/docs`);
  }
}

void arrancar();
