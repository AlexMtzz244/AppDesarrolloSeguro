import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { esquemaPaginacion } from '@securecampus/contracts';
import { Politica } from '../autorizacion/politica.decorator.js';
import { PrismaService } from '../comun/prisma.service.js';
import { validar } from '../comun/zod-validacion.pipe.js';

@ApiTags('alertas')
@Controller('alertas')
export class AlertasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Politica({ permiso: 'alerta:consultar', relacion: 'no-aplica', exigeMfa: true })
  @ApiOperation({
    summary: 'Alertas de seguridad pendientes (RF-090)',
    description:
      'Sin atender primero y por severidad. Una bitacora que nadie revisa no ' +
      'es un control, es un archivo (SC-LAB-002 escenario E).',
  })
  async listar(@Query(validar(esquemaPaginacion)) q: { pagina: number; tamano: number }) {
    const [total, alertas] = await Promise.all([
      this.prisma.alerta.count(),
      this.prisma.alerta.findMany({
        skip: (q.pagina - 1) * q.tamano,
        take: q.tamano,
        orderBy: [{ atendidaEl: { sort: 'asc', nulls: 'first' } }, { creadaEl: 'desc' }],
        select: {
          idPublico: true,
          tipo: true,
          severidad: true,
          detalle: true,
          creadaEl: true,
          atendidaEl: true,
        },
      }),
    ]);

    return {
      datos: alertas.map((a) => ({
        id: a.idPublico,
        tipo: a.tipo,
        severidad: a.severidad,
        detalle: a.detalle,
        creadaEl: a.creadaEl.toISOString(),
        atendidaEl: a.atendidaEl?.toISOString() ?? null,
      })),
      pagina: q.pagina,
      tamano: q.tamano,
      total,
    };
  }
}
