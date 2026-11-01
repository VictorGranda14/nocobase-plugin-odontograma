import { observer, useField, useForm } from '@formily/react';
import { useAPIClient } from '@nocobase/client';
import { Alert } from 'antd';
import React, { useEffect, useMemo } from 'react';
import { CAMPOS_FICHA_CLINICA, CAMPOS_LINEA, CAMPOS_PLAN, COLECCION_LINEAS } from './constants';
import { ElegirPlan } from './ElegirPlan';
import { PlanOdontograma } from './PlanOdontograma';
import { Linea, NuevaLinea, useCatalogo } from './tipos';
import { ordenZona } from './zonas';

type Plan = { id?: number; [CAMPOS_PLAN.fkPaciente]?: number; prestacionesAsociadas?: Linea[] } & Record<string, any>;

interface OdontogramaPlanFieldProps {
  value?: Plan | null;
  onChange?: (plan: Plan | null) => void;
}

// Plan de tratamiento de la ficha dental dentro del formulario de la ficha clínica. No llama a la API para
// guardar: cambia el valor del campo y NocoBase graba ficha dental, plan y prestaciones al pulsar «Guardar».
// observer: se vuelve a dibujar cuando cambia el paciente del formulario.
export const OdontogramaPlanField: React.FC<OdontogramaPlanFieldProps> = observer(({ value, onChange }) => {
  const api = useAPIClient();
  const field = useField();
  const form = useForm(); // formulario de la ficha clínica
  const { catalogo, cargando } = useCatalogo();
  const readOnly = !!(field.disabled || field.readPretty);

  // Formily inicia los campos de objeto en {}: sin plan elegido se deja en null, o NocoBase crearía un plan vacío al guardar.
  const sinPlan = !value?.id && !value?.[CAMPOS_PLAN.fkPaciente];
  useEffect(() => {
    if (value && sinPlan) onChange?.(null);
  }, [value, sinPlan, onChange]);

  const pacienteId: number | null =
    form.values?.[CAMPOS_FICHA_CLINICA.fkPaciente] ?? form.values?.[CAMPOS_FICHA_CLINICA.paciente]?.id ?? null;
  const lineasPlan: Linea[] = value?.[CAMPOS_PLAN.lineas] ?? [];

  // Las prestaciones nuevas aún no tienen id: en la vista llevan uno negativo según su posición.
  const lineas = useMemo(
    () =>
      lineasPlan
        .map((l, i) => ({ ...l, id: l.id ?? -(i + 1) }))
        .sort((a, b) => ordenZona(a.zona) - ordenZona(b.zona) || Math.abs(a.id) - Math.abs(b.id)),
    [lineasPlan],
  );
  const indiceDe = (linea: Linea) => (linea.id < 0 ? -linea.id - 1 : lineasPlan.findIndex((l) => l.id === linea.id));

  const cambiarLineas = (nuevas: Linea[]) => onChange?.({ ...value, [CAMPOS_PLAN.lineas]: nuevas });

  const agregar = ({ prestacion, zona, precio }: NuevaLinea) =>
    cambiarLineas([
      ...lineasPlan,
      {
        [CAMPOS_LINEA.fkPrestacion]: prestacion.id,
        [CAMPOS_LINEA.prestacion]: prestacion,
        [CAMPOS_LINEA.zona]: zona,
        [CAMPOS_LINEA.precio]: precio,
        [CAMPOS_LINEA.estado]: 'planificado',
      } as Linea,
    ]);

  // La atención de realización la registra el servidor al guardar; al volver a planificada se limpia aquí.
  const alternarEstado = (linea: Linea) => {
    const i = indiceDe(linea);
    const realizada = lineasPlan[i].estado !== 'realizado';
    cambiarLineas(
      lineasPlan.map((l, j) =>
        j !== i
          ? l
          : realizada
            ? { ...l, [CAMPOS_LINEA.estado]: 'realizado' }
            : { ...l, [CAMPOS_LINEA.estado]: 'planificado', [CAMPOS_LINEA.fkRealizacion]: null, [CAMPOS_LINEA.realizacion]: null },
      ),
    );
  };

  const eliminar = (linea: Linea) => {
    const i = indiceDe(linea);
    cambiarLineas(lineasPlan.filter((_, j) => j !== i));
  };

  const continuar = async (planId: number) => {
    const respuesta = await api.resource(COLECCION_LINEAS).list({
      filter: { [CAMPOS_LINEA.fkPlan]: planId },
      appends: [CAMPOS_LINEA.prestacion, CAMPOS_LINEA.realizacion],
      paginate: false,
      sort: ['id'],
    });
    onChange?.({ id: planId, [CAMPOS_PLAN.lineas]: respuesta?.data?.data ?? [] });
  };

  if (sinPlan) {
    if (!readOnly && !pacienteId) {
      return <Alert type="info" showIcon message="Elige el paciente de la ficha clínica para crear o continuar su plan de tratamiento." />;
    }
    return (
      <div data-odontograma>
        <ElegirPlan
          pacienteId={pacienteId}
          readOnly={readOnly}
          onCrear={async () => onChange?.({ [CAMPOS_PLAN.fkPaciente]: pacienteId, [CAMPOS_PLAN.lineas]: [] })}
          onContinuar={continuar}
        />
      </div>
    );
  }

  return (
    <PlanOdontograma
      lineas={lineas}
      catalogo={catalogo}
      cargandoCatalogo={cargando}
      readOnly={readOnly}
      onAgregar={agregar}
      onAlternarEstado={alternarEstado}
      onEliminar={eliminar}
    />
  );
});
