import { App } from 'antd';
import { useCallback } from 'react';
import { fechaCL } from './constants';
import { Linea } from './tipos';

export interface DatosAtencion {
  paciente?: Record<string, any> | null;
  funcionario?: Record<string, any> | null;
  fecha?: string | null;
  observaciones?: string | null;
  lineas: Linea[];
}

const nombrePaciente = (p: Record<string, any> = {}) =>
  p.nombreCompleto || [p.nomPaciente, p.apellido1Pac, p.apellido2Pac].filter(Boolean).join(' ');

const nombreFuncionario = (f: Record<string, any> = {}) =>
  f.nombreCompleto || [f.nombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(' ');

// Descarga el presupuesto en PDF de una atención; la usan el bloque y el campo del formulario.
export const useDescargarPresupuesto = () => {
  const { message } = App.useApp();
  return useCallback(
    async ({ paciente, funcionario, fecha, observaciones, lineas }: DatosAtencion, svg: SVGSVGElement | null) => {
      try {
        const { generarPresupuestoPdf } = await import('./pdf');
        const { conImagen } = await generarPresupuestoPdf({
          paciente: nombrePaciente(paciente ?? {}),
          rut: paciente?.rutPaciente,
          profesional: nombreFuncionario(funcionario ?? {}),
          fechaAtencion: fechaCL(fecha) || undefined,
          observaciones: observaciones ?? undefined,
          lineas: lineas.map((l) => ({
            zona: l.zona,
            prestacion: l.prestacionAsociada?.nombrePrestacion ?? '-',
            estado: l.estado,
            precio: Number(l.precio) || 0,
            seccion: l.seccion,
          })),
          svg,
        });
        if (!conImagen) message.warning('El PDF se generó sin la imagen del odontograma.');
      } catch (error) {
        console.error('[odontograma] PDF', error);
        message.error('No se pudo generar el PDF.');
      }
    },
    [message],
  );
};
