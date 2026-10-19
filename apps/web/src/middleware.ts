import { NextResponse, type NextRequest } from 'next/server';

const ORIGEN_API = new URL(process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001').origin;
const ES_PRODUCCION = process.env.NODE_ENV === 'production';

/**
 * CSP con nonce por peticion (SC-LAB-004, ZAP 10038). Segunda linea de defensa:
 * si alguna vez se cuela un XSS, el navegador no ejecuta scripts sin el nonce.
 */
export function middleware(peticion: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const directivas = [
    "default-src 'self'",
    // `unsafe-eval` solo lo necesita el refresco en caliente de `next dev`.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${ES_PRODUCCION ? '' : " 'unsafe-eval'"}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // React emite atributos `style` en linea; los elementos <style> siguen exigiendo nonce.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${ORIGEN_API}${ES_PRODUCCION ? '' : ' ws:'}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  const csp = directivas.join('; ');

  const cabeceras = new Headers(peticion.headers);
  cabeceras.set('x-nonce', nonce);
  cabeceras.set('Content-Security-Policy', csp);

  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set('Content-Security-Policy', csp);
  return respuesta;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
