import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AcademicoController } from '../academico/academico.controller.js';
import { AlertasController } from '../alertas/alertas.controller.js';
import { AuditoriaController } from '../auditoria/auditoria.controller.js';
import { CalificacionesController } from '../calificaciones/calificaciones.controller.js';
import { DecisionesController } from '../configuracion/decisiones.controller.js';
import { DocumentosController } from '../documentos/documentos.controller.js';
import { AutenticacionController } from '../identidad/autenticacion.controller.js';
import { PerfilesController } from '../perfiles/perfiles.controller.js';
import { SolicitudesController } from '../solicitudes/solicitudes.controller.js';
import { UsuariosController } from '../usuarios/usuarios.controller.js';
import {
  CLAVE_POLITICA,
  CLAVE_PUBLICO,
  type DefinicionPolitica,
} from './politica.decorator.js';

/**
 * Prueba estructural del deny by default (RNFS-002).
 *
 * # Por que esta prueba es distinta de las demas
 *
 * Las otras pruebas verifican que un control funciona. Esta verifica que
 * **nadie olvido declararlo**, que es un problema diferente y, segun
 * SC-LAB-001 §6, el que de verdad ocurre en produccion: "Cada endpoint nuevo
 * es una oportunidad de omitir la verificacion."
 *
 * El guard ya responde 403 ante una ruta sin politica, asi que el sistema no
 * queda inseguro por el olvido. Lo que esta prueba aporta es que el olvido se
 * descubra **en la build** y no cuando alguien reporte que un endpoint nuevo
 * devuelve 403 sin motivo aparente.
 *
 * Una ruta nueva solo pasa de dos formas: declarando su politica, o declarando
 * explicitamente que es publica **con una razon escrita**. Ambas cosas
 * aparecen en la revision de codigo; olvidarse, no.
 */

const CONTROLADORES = [
  AutenticacionController,
  PerfilesController,
  UsuariosController,
  AcademicoController,
  CalificacionesController,
  DocumentosController,
  SolicitudesController,
  AuditoriaController,
  AlertasController,
  DecisionesController,
];

interface RutaInspeccionada {
  readonly controlador: string;
  readonly metodo: string;
  readonly politica: DefinicionPolitica | undefined;
  readonly razonPublica: string | undefined;
}

function inspeccionarRutas(): RutaInspeccionada[] {
  const reflector = new Reflector();
  const rutas: RutaInspeccionada[] = [];

  for (const controlador of CONTROLADORES) {
    const prototipo = controlador.prototype as unknown as Record<string, unknown>;

    for (const nombre of Object.getOwnPropertyNames(prototipo)) {
      if (nombre === 'constructor') continue;
      const manejador = prototipo[nombre];
      if (typeof manejador !== 'function') continue;

      // Solo interesan los metodos que Nest expone como ruta HTTP.
      const esRuta = Reflect.hasMetadata('path', manejador);
      if (!esRuta) continue;

      rutas.push({
        controlador: controlador.name,
        metodo: nombre,
        politica: reflector.get<DefinicionPolitica | undefined>(CLAVE_POLITICA, manejador),
        razonPublica: reflector.get<string | undefined>(CLAVE_PUBLICO, manejador),
      });
    }
  }

  return rutas;
}

describe('deny by default: toda ruta declara su politica (RNFS-002)', () => {
  const rutas = inspeccionarRutas();

  it('encuentra rutas que inspeccionar', () => {
    // Guarda contra el falso positivo mas peligroso de esta prueba: si la
    // introspeccion dejara de funcionar, el bucle recorreria cero rutas y
    // todo pasaria en verde sin verificar nada.
    expect(rutas.length).toBeGreaterThan(15);
  });

  it('ninguna ruta queda sin politica ni marca de publica', () => {
    const huerfanas = rutas
      .filter((r) => !r.politica && !r.razonPublica)
      .map((r) => `${r.controlador}.${r.metodo}`);

    expect(
      huerfanas,
      'Estas rutas no declaran @Politica ni @Publico. El guard responderia 403, ' +
        'pero el olvido debe corregirse aqui, no descubrirse en produccion.',
    ).toEqual([]);
  });

  it('ninguna ruta es a la vez publica y con politica', () => {
    const ambiguas = rutas
      .filter((r) => r.politica && r.razonPublica)
      .map((r) => `${r.controlador}.${r.metodo}`);

    // La ambiguedad importa porque el guard resuelve `@Publico` primero: una
    // ruta con ambos decoradores seria publica, aunque quien la escribio
    // creyera haberla protegido.
    expect(ambiguas, 'Una ruta con ambos decoradores se comporta como publica.').toEqual([]);
  });

  it('cada ruta publica documenta por que lo es', () => {
    const sinRazon = rutas
      .filter((r) => r.razonPublica !== undefined && r.razonPublica.trim().length < 20)
      .map((r) => `${r.controlador}.${r.metodo}`);

    expect(
      sinRazon,
      'Una ruta publica exige una razon escrita: es lo que hace revisable la excepcion.',
    ).toEqual([]);
  });

  it('toda politica declara su resolvedor de relacion (RNFS-005)', () => {
    const sinRelacion = rutas
      .filter((r) => r.politica && r.politica.relacion === undefined)
      .map((r) => `${r.controlador}.${r.metodo}`);

    // `relacion` es obligatorio en el tipo, incluido el valor explicito
    // 'no-aplica'. Tener que escribirlo obliga a pensar si la operacion recae
    // sobre un recurso concreto; omitirlo es un error de tipos, no una ruta
    // sin verificar.
    expect(sinRelacion).toEqual([]);
  });

  it('las operaciones sobre el modelo de autorizacion exigen segundo factor', () => {
    const criticas = ['usuario:crear', 'usuario:modificar', 'rol:administrar', 'auditoria:consultar'];

    const sinMfa = rutas
      .filter((r) => r.politica && criticas.includes(r.politica.permiso) && !r.politica.exigeMfa)
      .map((r) => `${r.controlador}.${r.metodo} (${r.politica?.permiso})`);

    expect(
      sinMfa,
      'Si una cuenta administrativa se compromete, el segundo factor es lo que ' +
        'queda entre el atacante y el control total (SC-LAB-001 escenario 4).',
    ).toEqual([]);
  });
});
