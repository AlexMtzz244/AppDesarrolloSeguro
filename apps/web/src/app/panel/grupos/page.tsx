'use client';

import { Add16Regular, HatGraduation20Regular, PeopleTeam24Regular } from '@fluentui/react-icons';
import Link from 'next/link';
import * as React from 'react';
import { useSesion } from '@/componentes/sesion';
import {
  Boton,
  EncabezadoPagina,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Insignia,
  Panel,
  Tabla,
  Td,
  Th,
} from '@/componentes/ui';
import { useRecurso } from '@/lib/use-recurso';
import { FormularioGrupo } from './formulario-grupo';
import { GestionAsignacion } from './gestion-asignacion';
import { GestionInscripciones } from './gestion-inscripciones';
import type { Grupo } from './tipos';


export default function PaginaGrupos() {
  const { actor } = useSesion();
  const tiene = (p: string) => actor?.permisos.some((x) => x === p) ?? false;
  const esJefe = tiene('asignacion-docente:crear');
  const puedeCrear = tiene('grupo:crear');
  const puedeInscribir = tiene('inscripcion:crear');
  const esProfesor = tiene('calificacion:crear');

  const grupos = useRecurso<Grupo[]>('/grupos');
  const [expandido, setExpandido] = React.useState<string | null>(null);
  const [creando, setCreando] = React.useState(false);
  const columnas = 6 + (esJefe || puedeInscribir || esProfesor ? 1 : 0);

  return (
    <>
      <EncabezadoPagina
        icono={PeopleTeam24Regular}
        titulo="Grupos"
        descripcion={
          esJefe
            ? 'Grupos de tu programa. El alcance lo determina tu adscripcion, no un filtro de esta pantalla.'
            : esProfesor
              ? 'Grupos con asignacion docente vigente a tu nombre.'
              : 'Grupos visibles para tu cuenta.'
        }
        acciones={
          puedeCrear ? (
            <Boton onClick={() => setCreando((v) => !v)} aria-expanded={creando}>
              <Add16Regular aria-hidden />
              Nuevo grupo
            </Boton>
          ) : null
        }
      />

      {creando ? (
        <FormularioGrupo
          alTerminar={() => {
            setCreando(false);
            grupos.recargar();
          }}
        />
      ) : null}

      <Panel titulo="Listado">
        {grupos.cargando ? (
          <EstadoCargando />
        ) : grupos.error ? (
          <EstadoError
            mensaje={grupos.error.message}
            correlationId={grupos.error.correlationId}
            onReintentar={grupos.recargar}
          />
        ) : !grupos.datos?.length ? (
          <EstadoVacio mensaje="No hay grupos que mostrar." />
        ) : (
          <Tabla resumen="Grupos accesibles para el usuario">
            <thead>
              <tr>
                <Th>Grupo</Th>
                <Th>Materia</Th>
                <Th>Periodo</Th>
                <Th>Horario</Th>
                <Th>Profesor</Th>
                <Th>Inscritos</Th>
                {columnas > 6 ? <Th>Acciones</Th> : null}
              </tr>
            </thead>
            <tbody>
              {grupos.datos.map((grupo) => (
                <React.Fragment key={grupo.id}>
                  <tr>
                    <Td className="font-mono text-xs font-medium">{grupo.clave}</Td>
                    <Td>{grupo.materia.nombre}</Td>
                    <Td>
                      <span className="font-mono text-xs">{grupo.periodo.clave}</span>{' '}
                      {grupo.periodo.estado === 'cerrado' ? <Insignia tono="neutro">Cerrado</Insignia> : null}
                    </Td>
                    <Td className="text-xs">
                      {grupo.horario.map((bloque) => (
                        <span key={`${bloque.dia}${bloque.horaInicio}`} className="block">
                          {bloque.dia} {bloque.horaInicio}–{bloque.horaFin}
                        </span>
                      ))}
                    </Td>
                    <Td className="text-xs">
                      {grupo.profesor ? grupo.profesor.correo : <Insignia tono="aviso">Sin asignar</Insignia>}
                    </Td>
                    <Td className="font-mono text-xs">
                      {grupo.inscritos}/{grupo.cupo}
                    </Td>
                    {columnas > 6 ? (
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          {esProfesor ? (
                            <Boton asChild variante="contorno" tamano="sm">
                              <Link href={`/panel/calificaciones?grupo=${grupo.id}`}>
                                <HatGraduation20Regular className="h-4 w-4" aria-hidden />
                                Calificar
                              </Link>
                            </Boton>
                          ) : null}
                          {esJefe || puedeInscribir ? (
                            <Boton
                              variante="contorno"
                              tamano="sm"
                              aria-expanded={expandido === grupo.id}
                              onClick={() => setExpandido(expandido === grupo.id ? null : grupo.id)}
                            >
                              {expandido === grupo.id ? 'Ocultar' : 'Gestionar'}
                            </Boton>
                          ) : null}
                        </div>
                      </Td>
                    ) : null}
                  </tr>

                  {expandido === grupo.id ? (
                    <tr>
                      <td colSpan={columnas} className="border-b border-borde/50 bg-panel/60 px-3 py-4">
                        <div className="grid gap-6 xl:grid-cols-2">
                          {esJefe ? <GestionAsignacion grupo={grupo} alCambiar={grupos.recargar} /> : null}
                          {puedeInscribir ? (
                            <GestionInscripciones grupo={grupo} alCambiar={grupos.recargar} />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </Tabla>
        )}
      </Panel>
    </>
  );
}
