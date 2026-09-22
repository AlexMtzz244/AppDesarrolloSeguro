/**
 * Datos semilla de DESARROLLO (RNFS-058).
 *
 * # Estas credenciales no son secretas, y por eso mismo son peligrosas
 *
 * Estan documentadas en el README para que el equipo pueda entrar. Si un
 * despliegue productivo arrancara con ellas, cualquiera que haya leido el
 * repositorio tendria una cuenta de administrador. Por eso el script se niega
 * a correr cuando `NODE_ENV=production` sin una senal explicita.
 *
 * # Que NO se siembra
 *
 * El catalogo de tipos de solicitud, sus estados, responsables y SLA quedan
 * **vacios** (D-01). Sembrarlos con valores plausibles seria inventar reglas
 * academicas, que es justo lo que SC-SRS-001 §8 prohibe: "codificar un valor
 * inventado no lo convierte en decidido, lo convierte en invisible, que es
 * peor". El sistema arranca sin poder crear solicitudes, y eso es correcto
 * hasta que servicios escolares defina el catalogo.
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { ulid } from 'ulid';
import {
  MATRIZ_ROL_PERMISOS,
  PERMISOS,
  PERMISOS_QUE_EXIGEN_MOTIVO,
  ROLES_BASE,
  type Permiso,
  type RolBase,
} from '@securecampus/contracts';

const prisma = new PrismaClient();

/** Contrasena unica de desarrollo. Documentada, nunca reutilizable en otro entorno. */
const CONTRASENA_SEMILLA = 'SemillaDesarrollo!2026';

const DESCRIPCION_ROLES: Record<RolBase, { nombre: string; descripcion: string }> = {
  estudiante: {
    nombre: 'Estudiante',
    descripcion: 'Consulta su propio perfil, calificaciones, documentos y solicitudes.',
  },
  profesor: {
    nombre: 'Profesor',
    descripcion:
      'Consulta los grupos con asignacion docente vigente y captura calificaciones de sus alumnos inscritos.',
  },
  'jefe-carrera': {
    nombre: 'Jefe de carrera',
    descripcion:
      'Crea grupos de su propio programa y asigna profesor, horario y aula. No puede capturar calificaciones.',
  },
  administrador: {
    nombre: 'Administrador',
    descripcion:
      'Gestiona usuarios, roles y permisos con minimo privilegio, y consulta la auditoria.',
  },
};

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production' && process.env['PERMITIR_DATOS_SEMILLA'] !== 'true') {
    console.error(
      '\nRECHAZADO: no se siembran datos de desarrollo en produccion.\n' +
        'Estas credenciales estan documentadas publicamente en el README (RNFS-058).\n',
    );
    process.exit(1);
  }

  console.log('Sembrando datos de desarrollo...\n');

  // --- Permisos ------------------------------------------------------------
  for (const clave of PERMISOS) {
    const [recurso = '', operacion = ''] = clave.split(':');
    await prisma.permiso.upsert({
      where: { clave },
      create: {
        clave,
        recurso,
        operacion,
        descripcion: `Permite ${operacion} sobre ${recurso}.`,
        exigeMotivo: PERMISOS_QUE_EXIGEN_MOTIVO.includes(clave),
      },
      update: { exigeMotivo: PERMISOS_QUE_EXIGEN_MOTIVO.includes(clave) },
    });
  }
  console.log(`  ${PERMISOS.length} permisos`);

  // --- Roles y su matriz ---------------------------------------------------
  for (const clave of ROLES_BASE) {
    const meta = DESCRIPCION_ROLES[clave];
    const rol = await prisma.rol.upsert({
      where: { clave },
      create: { clave, nombre: meta.nombre, descripcion: meta.descripcion, esSistema: true },
      update: { nombre: meta.nombre, descripcion: meta.descripcion },
      select: { id: true },
    });

    // Se reemplaza el conjunto completo en vez de anadir: la matriz del
    // codigo es la fuente de verdad del estado inicial, y un permiso que se
    // quita de ella debe desaparecer tambien de la base.
    await prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } });

    const permisos = await prisma.permiso.findMany({
      where: { clave: { in: [...MATRIZ_ROL_PERMISOS[clave]] as string[] } },
      select: { id: true },
    });

    await prisma.rolPermiso.createMany({
      data: permisos.map((p) => ({ rolId: rol.id, permisoId: p.id })),
      skipDuplicates: true,
    });

    console.log(`  rol ${clave}: ${permisos.length} permisos`);
  }

  // --- Programa, periodo, materia y aula -----------------------------------
  const programa = await prisma.programa.upsert({
    where: { clave: 'ISC' },
    create: {
      idPublico: ulid(),
      clave: 'ISC',
      nombre: 'Ingenieria en Sistemas Computacionales',
    },
    update: {},
    select: { id: true },
  });

  const periodo = await prisma.periodo.upsert({
    where: { clave: '2026-2' },
    create: {
      idPublico: ulid(),
      clave: '2026-2',
      inicia: new Date('2026-08-10T00:00:00Z'),
      termina: new Date('2026-12-18T23:59:59Z'),
      estado: 'abierto',
    },
    update: {},
    select: { id: true },
  });

  // Un periodo CERRADO, para poder probar el rechazo de cambios retroactivos.
  await prisma.periodo.upsert({
    where: { clave: '2026-1' },
    create: {
      idPublico: ulid(),
      clave: '2026-1',
      inicia: new Date('2026-01-15T00:00:00Z'),
      termina: new Date('2026-06-05T23:59:59Z'),
      estado: 'cerrado',
      cerradoEl: new Date('2026-06-20T00:00:00Z'),
    },
    update: {},
  });

  const materia = await prisma.materia.upsert({
    where: { clave: 'ISC-601' },
    create: {
      idPublico: ulid(),
      clave: 'ISC-601',
      nombre: 'Desarrollo Seguro',
      creditos: 8,
      programaId: programa.id,
    },
    update: {},
    select: { id: true },
  });

  const aula = await prisma.aula.upsert({
    where: { clave: 'A-201' },
    create: { idPublico: ulid(), clave: 'A-201', edificio: 'A', capacidad: 40 },
    update: {},
    select: { id: true },
  });

  // --- Tipos de documento (D-04, valores por defecto seguros) --------------
  await prisma.tipoDocumento.upsert({
    where: { clave: 'constancia' },
    create: {
      idPublico: ulid(),
      clave: 'constancia',
      nombre: 'Constancia de estudios',
      mimesPermitidos: 'application/pdf',
      tamanoMaximoBytes: BigInt(10 * 1024 * 1024),
    },
    update: {},
  });

  await prisma.tipoDocumento.upsert({
    where: { clave: 'identificacion' },
    create: {
      idPublico: ulid(),
      clave: 'identificacion',
      nombre: 'Identificacion oficial',
      mimesPermitidos: 'application/pdf,image/jpeg,image/png',
      tamanoMaximoBytes: BigInt(5 * 1024 * 1024),
    },
    update: {},
  });

  // --- Usuarios, uno por rol ----------------------------------------------
  const contrasenaHash = await hash(CONTRASENA_SEMILLA);

  const cuentas: {
    correo: string;
    nombre: string;
    apellido: string;
    rol: RolBase;
    matricula?: string;
    conPrograma?: boolean;
  }[] = [
    {
      correo: 'admin@securecampus.edu.mx',
      nombre: 'Marelis',
      apellido: 'Carrillo',
      rol: 'administrador',
    },
    {
      correo: 'jefe.isc@securecampus.edu.mx',
      nombre: 'Diego',
      apellido: 'Salazar',
      rol: 'jefe-carrera',
      conPrograma: true,
    },
    {
      correo: 'profesor@securecampus.edu.mx',
      nombre: 'Juan Pablo',
      apellido: 'Castillo',
      rol: 'profesor',
      conPrograma: true,
    },
    {
      correo: 'estudiante.a@securecampus.edu.mx',
      nombre: 'Cesar Adan',
      apellido: 'De La Cruz',
      rol: 'estudiante',
      matricula: 'ISC202601',
      conPrograma: true,
    },
    // Segundo estudiante: existe para la prueba negativa 1. Sin dos cuentas del
    // mismo rol no se puede comprobar que A no alcanza los datos de B.
    {
      correo: 'estudiante.b@securecampus.edu.mx',
      nombre: 'Alejandro',
      apellido: 'Martinez',
      rol: 'estudiante',
      matricula: 'ISC202602',
      conPrograma: true,
    },
  ];

  const creados = new Map<string, string>();

  for (const cuenta of cuentas) {
    const rol = await prisma.rol.findUniqueOrThrow({
      where: { clave: cuenta.rol },
      select: { id: true },
    });

    const usuario = await prisma.usuario.upsert({
      where: { correo: cuenta.correo },
      create: {
        idPublico: ulid(),
        correo: cuenta.correo,
        contrasenaHash,
        perfil: {
          create: {
            nombre: cuenta.nombre,
            apellidoPaterno: cuenta.apellido,
            matricula: cuenta.matricula ?? null,
            programaId: cuenta.conPrograma ? programa.id : null,
          },
        },
      },
      update: { contrasenaHash },
      select: { id: true, idPublico: true },
    });

    const yaTiene = await prisma.asignacionRol.findFirst({
      where: { usuarioId: usuario.id, rolId: rol.id, revocadaEl: null },
      select: { id: true },
    });

    if (!yaTiene) {
      await prisma.asignacionRol.create({
        data: {
          idPublico: ulid(),
          usuarioId: usuario.id,
          rolId: rol.id,
          desdeEl: new Date(),
          motivo: 'Cuenta de desarrollo sembrada automaticamente',
          autorId: usuario.id,
          revisarEl: new Date(Date.now() + 182 * 86_400_000),
        },
      });
    }

    await prisma.cuotaUsuario.upsert({
      where: { usuarioId: usuario.id },
      create: {
        usuarioId: usuario.id,
        usadoBytes: 0n,
        limiteBytes: BigInt(100 * 1024 * 1024),
      },
      update: {},
    });

    creados.set(cuenta.correo, usuario.id);
    console.log(`  usuario ${cuenta.correo} (${cuenta.rol})`);
  }

  // --- Grupo con asignacion e inscripciones --------------------------------
  const grupo = await prisma.grupo.upsert({
    where: { clave_periodoId: { clave: 'ISC-601-A', periodoId: periodo.id } },
    create: {
      idPublico: ulid(),
      clave: 'ISC-601-A',
      programaId: programa.id,
      materiaId: materia.id,
      periodoId: periodo.id,
      aulaId: aula.id,
      cupo: 35,
      horario: {
        create: [
          { dia: 'lunes', inicioMin: 7 * 60, finMin: 9 * 60 },
          { dia: 'miercoles', inicioMin: 7 * 60, finMin: 9 * 60 },
        ],
      },
    },
    update: {},
    select: { id: true, idPublico: true },
  });

  const profesorId = creados.get('profesor@securecampus.edu.mx')!;
  const jefeId = creados.get('jefe.isc@securecampus.edu.mx')!;

  const asignacionVigente = await prisma.asignacionDocente.findFirst({
    where: { grupoId: grupo.id, hastaEl: null },
    select: { id: true },
  });

  if (!asignacionVigente) {
    await prisma.asignacionDocente.create({
      data: {
        idPublico: ulid(),
        grupoId: grupo.id,
        profesorId,
        version: 1,
        desdeEl: new Date('2026-08-10T00:00:00Z'),
        autorId: jefeId,
        motivo: 'Asignacion inicial del periodo, sembrada para desarrollo',
      },
    });
  }

  for (const correo of ['estudiante.a@securecampus.edu.mx', 'estudiante.b@securecampus.edu.mx']) {
    const estudianteId = creados.get(correo)!;
    await prisma.inscripcion.upsert({
      where: { grupoId_estudianteId: { grupoId: grupo.id, estudianteId } },
      create: { idPublico: ulid(), grupoId: grupo.id, estudianteId },
      update: {},
    });
  }

  // --- Parametros pendientes de aprobacion (SC-SRS-001 §8) -----------------
  const pendientes: { clave: string; valor: string; descripcion: string; decision: string }[] = [
    {
      clave: 'solicitudes.catalogo',
      valor: 'vacio',
      descripcion:
        'Catalogo de tipos, estados, responsables y SLA. Se siembra VACIO a proposito: es una decision de servicios escolares.',
      decision: 'D-01',
    },
    {
      clave: 'perfil.campos_editables',
      valor: 'telefono',
      descripcion: 'Campos que el titular puede modificar de su propio perfil.',
      decision: 'D-02',
    },
    {
      clave: 'calificaciones.escala',
      valor: '0-100',
      descripcion:
        'Escala y reglas de publicacion/correccion. No se codifica ninguna regla de aprobacion ni de redondeo.',
      decision: 'D-03',
    },
    {
      clave: 'periodo.autoridad_retroactiva',
      valor: 'sin-designar',
      descripcion:
        'Autoridad superior para cambios retroactivos. Mientras no se designe, el flujo queda bloqueado.',
      decision: 'D-07',
    },
    {
      clave: 'roles.frecuencia_revision_dias',
      valor: '182',
      descripcion: 'Frecuencia de revision de la matriz rol-permiso-operacion.',
      decision: 'D-08',
    },
    {
      clave: 'auditoria.retencion_dias',
      valor: '200',
      descripcion:
        'Retencion minima de la bitacora. Un semestre completo, porque el fraude del escenario 5 se detecta tarde por naturaleza.',
      decision: 'D-09',
    },
  ];

  for (const p of pendientes) {
    await prisma.parametroConfiguracion.upsert({
      where: { clave: p.clave },
      create: {
        clave: p.clave,
        valor: p.valor,
        descripcion: p.descripcion,
        decisionId: p.decision,
      },
      update: { descripcion: p.descripcion, decisionId: p.decision },
    });
  }
  console.log(`  ${pendientes.length} parametros pendientes de aprobacion`);

  console.log(
    [
      '',
      '=================================================================',
      ' Semillas listas.',
      '',
      ` Contrasena para TODAS las cuentas: ${CONTRASENA_SEMILLA}`,
      '',
      ' Son credenciales de DESARROLLO, documentadas en el README.',
      ' El arranque en produccion las rechaza (RNFS-058).',
      '',
      ' Ningun tipo de solicitud fue sembrado: D-01 esta pendiente y',
      ' el sistema no inventa reglas academicas.',
      '=================================================================',
      '',
    ].join('\n'),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
