import { redirect } from 'next/navigation';

export default function Inicio() {
  // No hay pagina publica de presentacion: es una herramienta interna, no un
  // sitio de marketing.
  redirect('/panel');
}
