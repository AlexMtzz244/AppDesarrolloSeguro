import { HttpStatus, Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { Actor } from '../autorizacion/actor.js';
import { ErrorNegocio } from '../comun/excepciones.filter.js';
import { PrismaService } from '../comun/prisma.service.js';

/**
 * Periodos academicos y cierre (RF-021, RF-033).
 *
 * El periodo es una maquina de estados, no una comparacion de fechas dispersa
 * por el codigo. La diferencia importa: una comparacion hay que acordarse de
 * escribirla en cada punto que la necesite, y basta olvidarla en uno para que
 * se pueda escribir sobre un semestre cerrado.
 *
 * SC-LAB-001 escenario 5, vulnerabilidad (b): "No se valida que el periodo
 * este abierto, de modo que se permiten cambios retroactivos sobre semestres
 * cerrados."
 */
@Injectable()
export class PeriodosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar() {
    const periodos = await this.prisma.periodo.findMany({
      orderBy: { inicia: 'desc' },
      select: {
        idPublico: true,
        clave: true,
        inicia: true,
        termina: true,
        estado: true,
        cerradoEl: true,
      },
    });

    return periodos.map((p) => ({
      id: p.idPublico,
      clave: p.clave,
      inicia: p.inicia.toISOString(),
      termina: p.termina.toISOString(),
      estado: p.estado,
      cerradoEl: p.cerradoEl?.toISOString() ?? null,
    }));
  }

  async cerrar(actor: Actor, idPublico: string, motivo: string) {
    return this.prisma.$transaction(async (tx) => {
      const periodo = await tx.periodo.findUnique({
        where: { idPublico },
        select: { id: true, idPublico: true, clave: true, estado: true },
      });

      if (!periodo) throw new ErrorNegocio('PERIODO_DESCONOCIDO', 'El periodo no existe.');
      if (periodo.estado === 'cerrado') {
        throw new ErrorNegocio('PERIODO_YA_CERRADO', 'El periodo ya esta cerrado.', HttpStatus.CONFLICT);
      }

      const ahora = new Date();
      await tx.periodo.update({
        where: { id: periodo.id },
        data: { estado: 'cerrado', cerradoEl: ahora },
      });

      await this.auditoria.registrar(tx, {
        accion: 'periodo.cierre',
        tipoRecurso: 'periodo',
        recursoId: periodo.idPublico,
        resultado: 'exito',
        motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        antes: { estado: 'abierto' },
        despues: { estado: 'cerrado', cerradoEl: ahora },
      });

      return { id: periodo.idPublico, estado: 'cerrado', cerradoEl: ahora.toISOString() };
    });
  }

  /**
   * Concede una autorizacion extraordinaria para tocar un periodo cerrado.
   *
   * Se modela como entidad con vigencia y de un solo uso, no como una bandera
   * en la peticion. Una bandera la marca quien hace el cambio; una
   * autorizacion la concede alguien mas, deja rastro y caduca.
   *
   * **D-07 resuelto por separacion de funciones, no por designacion.**
   *
   * La pregunta original era "quien es la autoridad superior". Designar a una
   * persona con `periodo:modificar-retroactivo` habria creado una cuenta capaz
   * de alterar el pasado por si sola.
   *
   * La respuesta que adoptamos parte el permiso en dos: `:autorizar-` concede,
   * `:modificar-` ejecuta, y RNFS-007 los declara incompatibles. Ninguna
   * cuenta puede tener ambos, asi que **un cambio retroactivo exige
   * forzosamente dos personas distintas y dos motivos escritos**.
   *
   * Es el mismo razonamiento que SC-LAB-001 escenario 5 aplica al jefe de
   * carrera: no se le quita su funcion legitima, se le quita la posibilidad de
   * **encadenarla** con la operacion que la aprovecha.
   */
  async autorizarCambioRetroactivo(
    actor: Actor,
    periodoIdPublico: string,
    motivo: string,
    vigenteHoras: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const periodo = await tx.periodo.findUnique({
        where: { idPublico: periodoIdPublico },
        select: { id: true, idPublico: true, estado: true },
      });

      if (!periodo) throw new ErrorNegocio('PERIODO_DESCONOCIDO', 'El periodo no existe.');
      if (periodo.estado !== 'cerrado') {
        throw new ErrorNegocio(
          'PERIODO_ABIERTO',
          'Un periodo abierto no necesita autorizacion extraordinaria.',
          HttpStatus.CONFLICT,
        );
      }

      const autorizacion = await tx.autorizacionExtraordinaria.create({
        data: {
          idPublico: ulid(),
          periodoId: periodo.id,
          otorgadaPorId: actor.usuarioId,
          motivo,
          vigenteHasta: new Date(Date.now() + vigenteHoras * 3_600_000),
        },
        select: { idPublico: true, vigenteHasta: true },
      });

      await this.auditoria.registrar(tx, {
        accion: 'periodo.cambio-retroactivo',
        tipoRecurso: 'autorizacion-extraordinaria',
        recursoId: autorizacion.idPublico,
        resultado: 'exito',
        motivo,
        actorId: actor.usuarioId,
        actorCorreo: actor.correo,
        despues: { periodo: periodo.idPublico, vigenteHasta: autorizacion.vigenteHasta },
      });

      // Alerta critica en el acto, no en el barrido periodico de cada 10
      // minutos. Un cambio retroactivo sobre un semestre cerrado es el evento
      // mas grave que el sistema admite, y el barrido existe para patrones
      // temporales que necesitan un segundo evento para ser visibles; este no.
      await tx.alerta.create({
        data: {
          idPublico: ulid(),
          tipo: 'cambio-privilegio',
          severidad: 'critica',
          detalle:
            `${actor.correo} concedio autorizacion extraordinaria sobre un periodo ` +
            `cerrado, vigente ${vigenteHoras} h. Motivo: ${motivo}. ` +
            'Verificar que el cambio ejecutado despues corresponda a lo autorizado. ' +
            'Quien concede no puede ejecutar: debe haber una segunda cuenta involucrada.',
          claveIdempotencia: `autorizacion-extraordinaria:${autorizacion.idPublico}`,
        },
      });

      return {
        id: autorizacion.idPublico,
        vigenteHasta: autorizacion.vigenteHasta.toISOString(),
      };
    });
  }

  /**
   * Autorizaciones extraordinarias de un periodo, usadas y sin usar.
   *
   * Se listan TODAS, no solo las vigentes. Una autorizacion consumida hace
   * tres meses es precisamente la que interesa al revisar si el pasado se
   * altero, y ocultarla dejaria la revision ciega justo donde importa.
   */
  async listarAutorizaciones(periodoIdPublico: string) {
    const periodo = await this.prisma.periodo.findUnique({
      where: { idPublico: periodoIdPublico },
      select: { id: true },
    });
    if (!periodo) throw new ErrorNegocio('PERIODO_DESCONOCIDO', 'El periodo no existe.');

    const autorizaciones = await this.prisma.autorizacionExtraordinaria.findMany({
      where: { periodoId: periodo.id },
      orderBy: { creadaEl: 'desc' },
      select: {
        idPublico: true,
        motivo: true,
        vigenteHasta: true,
        usadaEl: true,
        creadaEl: true,
      },
    });

    const ahora = new Date();
    return autorizaciones.map((a) => ({
      id: a.idPublico,
      motivo: a.motivo,
      creadaEl: a.creadaEl.toISOString(),
      vigenteHasta: a.vigenteHasta.toISOString(),
      usadaEl: a.usadaEl?.toISOString() ?? null,
      estado: a.usadaEl ? 'usada' : a.vigenteHasta <= ahora ? 'vencida' : 'vigente',
    }));
  }

  /**
   * Consume una autorizacion. Devuelve `false` si no existe, vencio o ya se uso.
   *
   * El `updateMany` con filtro `usadaEl: null` hace la comprobacion y la marca
   * en una sola operacion, cerrando la carrera entre dos peticiones que
   * intenten usar la misma autorizacion a la vez.
   */
  async consumirAutorizacion(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    autorizacionIdPublico: string,
    periodoId: string,
  ): Promise<boolean> {
    const resultado = await tx.autorizacionExtraordinaria.updateMany({
      where: {
        idPublico: autorizacionIdPublico,
        periodoId,
        usadaEl: null,
        vigenteHasta: { gt: new Date() },
      },
      data: { usadaEl: new Date() },
    });
    return resultado.count === 1;
  }
}
