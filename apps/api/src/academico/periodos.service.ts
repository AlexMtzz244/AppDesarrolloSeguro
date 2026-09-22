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
   * D-07 esta pendiente: mientras direccion academica no designe a la
   * autoridad superior, ninguna cuenta tiene `periodo:modificar-retroactivo`
   * en la matriz sembrada, asi que este flujo queda **bloqueado**. Ese es el
   * valor por defecto seguro: no se inventa una jerarquia que no existe.
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

      return {
        id: autorizacion.idPublico,
        vigenteHasta: autorizacion.vigenteHasta.toISOString(),
      };
    });
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
