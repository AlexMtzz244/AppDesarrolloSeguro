export interface Grupo {
  readonly id: string;
  readonly clave: string;
  readonly cupo: number;
  readonly inscritos: number;
  readonly materia: { clave: string; nombre: string };
  readonly periodo: { clave: string; estado: string };
  readonly aula: { clave: string; edificio: string };
  readonly programa: { clave: string; nombre: string };
  readonly horario: { dia: string; horaInicio: string; horaFin: string }[];
  readonly profesor: { idPublico: string; correo: string } | null;
}

export interface Persona {
  readonly id: string;
  readonly correo: string;
  readonly matricula: string | null;
  readonly nombre: string;
}
