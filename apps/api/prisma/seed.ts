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
 * # Sobre los catalogos sembrados como PROPUESTA
 *
 * SC-SRS-001 §8 prohibe codificar valores inventados porque "se vuelven
 * invisibles, que es peor". La lectura literal —no sembrar nada— dejaba tres
 * funciones bloqueadas sin que nadie pudiera probarlas ni opinar sobre ellas.
 *
 * La lectura correcta es que el problema no era decidir, sino que la decision
 * quedara invisible. Asi que lo sembrado aqui:
 *
 *   - es una PROPUESTA concreta, no un valor silencioso;
 *   - queda con `aprobadoPor = null`, es decir, SIN FIRMA;
 *   - la interfaz lo muestra como no aprobado;
 *   - y el arranque en produccion FALLA mientras siga sin aprobar
 *     (`DecisionesService.onApplicationBootstrap`).
 *
 * Un valor que impide desplegar no es invisible: es imposible de ignorar. Es
 * el mismo patron de la bitacora append-only —visible, atribuible,
 * irreversible— aplicado a la configuracion.
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { ulid } from 'ulid';
import {
  DECISIONES_BLOQUEANTES,
  MATRIZ_ROL_PERMISOS,
  PERMISOS,
  PERMISOS_QUE_EXIGEN_MOTIVO,
  ROLES_BASE,
  type IdDecision,
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
  'autoridad-academica': {
    nombre: 'Autoridad academica',
    descripcion:
      'Concede autorizaciones extraordinarias sobre periodos cerrados. NO puede ejecutarlas ' +
      'ni capturar calificaciones: por separacion de funciones, un cambio retroactivo exige ' +
      'dos cuentas distintas (D-07).',
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
      correo: 'autoridad@securecampus.edu.mx',
      nombre: 'Direccion',
      apellido: 'Academica',
      rol: 'autoridad-academica',
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

  // --- Catalogo de solicitudes: PROPUESTA de D-01 -------------------------
  //
  // Tres tramites que existen en cualquier institucion, con un flujo comun.
  // Ninguno inventa una regla academica: no definen requisitos, plazos de
  // titulacion ni criterios de procedencia. Solo abren el canal para pedir y
  // dar seguimiento, que es lo que RF-060 exige.
  //
  // El segundo resuelve ademas un hueco que nadie habia nombrado: el flujo de
  // correccion de calificaciones no tenia punto de entrada documentado, asi
  // que toda correccion aparecia en la bitacora sin causa registrada.
  //
  // Y el tercero cubre el que D-02 dejaba abierto: no existia via para que un
  // estudiante pidiera corregir su nombre o matricula, datos que a proposito
  // no son editables por el titular.
  const tiposSolicitud: {
    clave: string;
    nombre: string;
    descripcion: string;
    slaHoras: number;
  }[] = [
    {
      clave: 'constancia-estudios',
      nombre: 'Constancia de estudios',
      descripcion:
        'Solicitud de constancia que acredita la inscripcion vigente. El documento emitido ' +
        'se adjunta a esta misma solicitud.',
      slaHoras: 120,
    },
    {
      clave: 'revision-calificacion',
      nombre: 'Revision de calificacion',
      descripcion:
        'Solicitud de revision de una calificacion ya publicada. Es la via formal por la que ' +
        'se origina una correccion: sin ella, el flujo de correccion carece de punto de ' +
        'entrada documentado y las correcciones aparecen sin causa registrada.',
      slaHoras: 120,
    },
    {
      clave: 'correccion-datos-perfil',
      nombre: 'Correccion de datos personales',
      descripcion:
        'Solicitud para corregir nombre, apellidos o matricula. Esos campos no son editables ' +
        'por el titular a proposito, porque permitirlo convertiria el perfil en una via de ' +
        'suplantacion; esta solicitud da el canal con responsable y rastro.',
      slaHoras: 120,
    },
  ];

  // Flujo generico y minimo. Deliberadamente NO modela etapas internas de
  // ninguna area: inventarlas seria describir un proceso administrativo que
  // nadie nos conto.
  const estadosFlujo = [
    { clave: 'recibida', nombre: 'Recibida', esInicial: true, esFinal: false, orden: 1 },
    { clave: 'en-revision', nombre: 'En revision', esInicial: false, esFinal: false, orden: 2 },
    { clave: 'resuelta', nombre: 'Resuelta', esInicial: false, esFinal: true, orden: 3 },
    { clave: 'rechazada', nombre: 'Rechazada', esInicial: false, esFinal: true, orden: 4 },
  ];

  for (const tipo of tiposSolicitud) {
    const registro = await prisma.tipoSolicitud.upsert({
      where: { clave: tipo.clave },
      create: {
        idPublico: ulid(),
        clave: tipo.clave,
        nombre: tipo.nombre,
        descripcion: tipo.descripcion,
        slaHoras: tipo.slaHoras,
      },
      update: { descripcion: tipo.descripcion, slaHoras: tipo.slaHoras },
      select: { id: true },
    });

    for (const estado of estadosFlujo) {
      await prisma.estadoSolicitud.upsert({
        where: {
          tipoSolicitudId_clave: { tipoSolicitudId: registro.id, clave: estado.clave },
        },
        create: { idPublico: ulid(), tipoSolicitudId: registro.id, ...estado },
        update: { nombre: estado.nombre, orden: estado.orden },
      });
    }
  }
  console.log(`  ${tiposSolicitud.length} tipos de solicitud (PROPUESTA D-01, sin firma)`);

  // --- Parametros de las decisiones institucionales (SC-SRS-001 §8) --------
  //
  // Todos se siembran SIN firma. `DecisionesService` los lee al arrancar y, en
  // produccion, detiene el proceso si una decision bloqueante sigue asi.
  const parametros: {
    clave: string;
    valor: string;
    descripcion: string;
    decision: IdDecision;
  }[] = [
    {
      clave: 'solicitudes.catalogo',
      valor: tiposSolicitud.map((t) => t.clave).join(','),
      descripcion:
        'Tipos de solicitud habilitados. PROPUESTA: tres tramites genericos con flujo ' +
        'recibida -> en revision -> resuelta/rechazada.',
      decision: 'D-01',
    },
    {
      clave: 'solicitudes.sla_horas',
      valor: '120',
      descripcion: 'SLA por omision de cada tipo de solicitud, en horas.',
      decision: 'D-01',
    },
    {
      clave: 'perfil.campos_editables',
      valor: 'telefono',
      descripcion:
        'Campos editables por el titular. La correccion de los demas entra por el tipo de ' +
        'solicitud correccion-datos-perfil.',
      decision: 'D-02',
    },
    {
      clave: 'calificaciones.escala',
      valor: '0-100',
      descripcion:
        'Escala y reglas de publicacion/correccion. No se codifica regla de aprobacion, ' +
        'redondeo ni ponderacion.',
      decision: 'D-03',
    },
    {
      clave: 'documentos.tipos_permitidos',
      valor: 'application/pdf,image/jpeg,image/png',
      descripcion: 'Formatos aceptados, verificados por magic bytes.',
      decision: 'D-04',
    },
    {
      clave: 'seguridad.umbrales_login',
      valor: '5/15min-cuenta,20/15min-origen',
      descripcion: 'Umbrales de limite de intentos. Requieren calibracion contra trafico real.',
      decision: 'D-05',
    },
    {
      clave: 'mfa.restablecimiento',
      valor: 'presencial-doble-aprobacion',
      descripcion:
        'PROPUESTA: perdido el dispositivo Y los codigos, el restablecimiento exige solicitud ' +
        'presencial con identificacion oficial y DOS aprobaciones administrativas distintas. ' +
        'El restablecimiento NO otorga acceso: solo borra la credencial para que el titular ' +
        'vuelva a enrolarse. Un rescate que diera acceso seria la via preferida para saltarse ' +
        'el segundo factor.',
      decision: 'D-06',
    },
    {
      clave: 'mfa.proveedor',
      valor: 'totp-propio',
      descripcion: 'TOTP local con 10 codigos de recuperacion de un solo uso.',
      decision: 'D-06',
    },
    {
      clave: 'periodo.autoridad_retroactiva',
      valor: 'rol:autoridad-academica',
      descripcion:
        'PROPUESTA: no se designa a una persona con poder para alterar el pasado. Se parte el ' +
        'permiso en dos —autorizar y ejecutar— declarados incompatibles por RNFS-007, de modo ' +
        'que un cambio retroactivo exige dos cuentas distintas y dos motivos escritos. Falta ' +
        'designar QUIEN ocupa el rol autoridad-academica.',
      decision: 'D-07',
    },
    {
      clave: 'periodo.vigencia_autorizacion_horas',
      valor: '24',
      descripcion:
        'Vigencia por omision de una autorizacion extraordinaria; maximo admitido 72 h. Una ' +
        'autorizacion indefinida dejaria de ser excepcional.',
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
        'Retencion minima de la bitacora: un semestre completo, porque el fraude del ' +
        'escenario 5 se detecta tarde por naturaleza.',
      decision: 'D-09',
    },
    {
      clave: 'plataforma.sla',
      valor: 'sin-definir',
      descripcion:
        'Volumen, concurrencia, RTO y RPO. Unica de las once para la que el equipo no puede ' +
        'proponer nada: no hay cifras que estimar sin la institucion.',
      decision: 'D-10',
    },
    {
      clave: 'operacion.procedimiento_incidentes',
      valor: 'docs/OPERACION.md',
      descripcion: 'Procedimiento base escrito, pendiente de aprobar y de ensayar.',
      decision: 'D-11',
    },
  ];

  for (const parametro of parametros) {
    await prisma.parametroConfiguracion.upsert({
      where: { clave: parametro.clave },
      create: {
        clave: parametro.clave,
        valor: parametro.valor,
        descripcion: parametro.descripcion,
        decisionId: parametro.decision,
        // Sin firma. Es el punto entero de este bloque.
        aprobadoPor: null,
        aprobadoEl: null,
      },
      update: { descripcion: parametro.descripcion, decisionId: parametro.decision },
    });
  }

  const bloqueantes = DECISIONES_BLOQUEANTES.join(', ');
  console.log(`  ${parametros.length} parametros, ninguno aprobado todavia`);

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
      ' Los catalogos se sembraron como PROPUESTA, sin firma.',
      ` Bloquean el arranque en produccion: ${bloqueantes}`,
      '',
      ' Revisalas en /panel/decisiones o en docs/DECISIONES-PENDIENTES.md.',
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
