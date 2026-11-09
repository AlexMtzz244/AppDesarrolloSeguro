/**
 * Contador global de peticiones a la API en curso.
 *
 * Es la unica fuente de verdad de "hay actividad": `llamar` lo incrementa al
 * enviar y lo decrementa al terminar (con exito o con error), y la barra
 * superior solo lo lee. Asi ninguna pantalla tiene que acordarse de avisar.
 */

let pendientes = 0;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((oyente) => oyente());
}

export function iniciarActividad(): () => void {
  pendientes += 1;
  avisar();
  let terminada = false;
  // El cierre es idempotente: un `finally` repetido no deja el contador en
  // negativo ni apaga la barra mientras otra peticion sigue en vuelo.
  return () => {
    if (terminada) return;
    terminada = true;
    pendientes = Math.max(0, pendientes - 1);
    avisar();
  };
}

export function suscribirActividad(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export const peticionesPendientes = (): number => pendientes;
