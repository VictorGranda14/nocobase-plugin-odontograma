import { useAPIClient, useCollection, useCollectionRecordData, useCurrentPopupRecord, useRequest, withDynamicSchemaProps } from '@nocobase/client';
import { Alert, App, Spin } from 'antd';
import React, { useMemo } from 'react';
import { CAMPOS_FICHA, CAMPOS_LINEA, CAMPOS_PLAN, COLECCION_FICHA, COLECCION_LINEAS, COLECCION_PLAN } from './constants';
import { ElegirPlan } from './ElegirPlan';
import { PlanOdontograma } from './PlanOdontograma';
import { useDescargarPresupuesto } from './presupuesto';
import { Linea, NuevaLinea, useCatalogo } from './tipos';
import { etiquetaZona } from './zonas';

export interface OdontogramaBlockProps {
  readOnly?: boolean;
}

// El registro del popup llega por el contexto de registro o, si no, por el del popup.
function useFichaDental() {
  const registro = useCollectionRecordData();
  const coleccion = useCollection();
  const popup = useCurrentPopupRecord?.();
  if (coleccion?.name === COLECCION_FICHA && registro?.id) return registro.id;
  if (popup?.collection?.name === COLECCION_FICHA && popup?.value?.id) return popup.value.id;
  return null;
}

const OdontogramaBlockBase: React.FC<OdontogramaBlockProps> = ({ readOnly = false }) => {
  const fichaId = useFichaDental();
  const api = useAPIClient();
  const { message } = App.useApp();
  const { catalogo, cargando: cargandoCatalogo } = useCatalogo();
  const descargarPresupuesto = useDescargarPresupuesto();

  // La ficha dental es la atención; las prestaciones pertenecen a su plan de tratamiento.
  const fichaReq = useRequest<{ data: Record<string, any> }>(
    {
      resource: COLECCION_FICHA,
      action: 'get',
      params: {
        filterByTk: fichaId,
        appends: [`${CAMPOS_FICHA.fichaClinica}.${CAMPOS_FICHA.paciente}`, `${CAMPOS_FICHA.fichaClinica}.${CAMPOS_FICHA.funcionario}`],
      },
    },
    { ready: !!fichaId, refreshDeps: [fichaId] },
  );
  const ficha = fichaReq.data?.data;
  const planId: number | null = ficha?.[CAMPOS_FICHA.fkPlan] ?? null;
  // Con appends anidados la ficha clínica llega solo con sus relaciones, sin sus claves foráneas.
  const pacienteId: number | null = ficha?.[CAMPOS_FICHA.fichaClinica]?.[CAMPOS_FICHA.paciente]?.id ?? null;

  const lineasReq = useRequest<{ data: Linea[] }>(
    {
      resource: COLECCION_LINEAS,
      action: 'list',
      params: {
        filter: { [CAMPOS_LINEA.fkPlan]: planId },
        appends: [CAMPOS_LINEA.prestacion, CAMPOS_LINEA.realizacion],
        paginate: false,
        sort: ['id'],
      },
    },
    { ready: !!planId, refreshDeps: [planId] },
  );

  // En orden de creación (por id); la tabla las agrupa por sección y ordena por zona.
  const lineas = useMemo(() => lineasReq.data?.data ?? [], [lineasReq.data]);

  const ejecutar = async (accion: () => Promise<unknown>, exito?: string) => {
    try {
      await accion();
      if (exito) message.success(exito);
      lineasReq.refresh();
    } catch (error) {
      // El cliente de NocoBase ya notifica los errores de la API (permisos, validación…).
      console.error('[odontograma]', error);
    }
  };

  const agregar = ({ prestacion, zona, precio, seccion }: NuevaLinea) =>
    ejecutar(
      () =>
        api.resource(COLECCION_LINEAS).create({
          values: {
            [CAMPOS_LINEA.fkPlan]: planId,
            [CAMPOS_LINEA.fkPrestacion]: prestacion.id,
            [CAMPOS_LINEA.zona]: zona,
            [CAMPOS_LINEA.precio]: precio,
            [CAMPOS_LINEA.estado]: 'planificado',
            [CAMPOS_LINEA.seccion]: seccion,
          },
        }),
      `${prestacion.nombrePrestacion} agregada en ${etiquetaZona(zona).toLowerCase()}`,
    );

  // Al marcarla como realizada se registra la atención actual; al volver a planificada se limpia.
  const alternarEstado = (linea: Linea) => {
    const realizada = linea.estado !== 'realizado';
    return ejecutar(() =>
      api.resource(COLECCION_LINEAS).update({
        filterByTk: linea.id,
        values: {
          [CAMPOS_LINEA.estado]: realizada ? 'realizado' : 'planificado',
          [CAMPOS_LINEA.fkRealizacion]: realizada ? fichaId : null,
        },
      }),
    );
  };

  const eliminar = (linea: Linea) => ejecutar(() => api.resource(COLECCION_LINEAS).destroy({ filterByTk: linea.id }));

  // Las secciones son texto en cada prestación: se cambian una a una, y se borran siempre por id.
  const deSeccion = (nombre: string) => lineas.filter((l) => l.seccion?.trim() === nombre);
  const renombrarSeccion = (nombre: string, nuevo: string) =>
    ejecutar(() =>
      Promise.all(deSeccion(nombre).map((l) => api.resource(COLECCION_LINEAS).update({ filterByTk: l.id, values: { [CAMPOS_LINEA.seccion]: nuevo } }))),
    );
  const eliminarSeccion = (nombre: string) =>
    ejecutar(() => Promise.all(deSeccion(nombre).map((l) => api.resource(COLECCION_LINEAS).destroy({ filterByTk: l.id }))));

  const asociarPlan = async (id: number) => {
    await api.resource(COLECCION_FICHA).update({ filterByTk: fichaId, values: { [CAMPOS_FICHA.fkPlan]: id } });
    await fichaReq.refresh();
  };

  const crearPlan = async () => {
    const respuesta = await api.resource(COLECCION_PLAN).create({ values: { [CAMPOS_PLAN.fkPaciente]: pacienteId } });
    await asociarPlan(respuesta?.data?.data?.id);
  };

  const descargarPdf = (svg: SVGSVGElement | null) =>
    descargarPresupuesto(
      {
        paciente: ficha?.[CAMPOS_FICHA.fichaClinica]?.[CAMPOS_FICHA.paciente],
        funcionario: ficha?.[CAMPOS_FICHA.fichaClinica]?.[CAMPOS_FICHA.funcionario],
        fecha: ficha?.[CAMPOS_FICHA.fecha],
        observaciones: ficha?.[CAMPOS_FICHA.observaciones],
        lineas,
      },
      svg,
    );

  if (!fichaId) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Odontograma"
        description="Este bloque debe estar dentro del popup «Ver» de una Ficha Dental."
      />
    );
  }

  if (!ficha) {
    return (
      <div data-odontograma>
        <Spin />
      </div>
    );
  }

  if (!planId) {
    return (
      <div data-odontograma>
        <ElegirPlan pacienteId={pacienteId} readOnly={readOnly} onCrear={crearPlan} onContinuar={asociarPlan} />
      </div>
    );
  }

  return (
    <PlanOdontograma
      lineas={lineas}
      catalogo={catalogo}
      cargandoCatalogo={cargandoCatalogo}
      cargandoLineas={lineasReq.loading}
      readOnly={readOnly}
      onAgregar={agregar}
      onAlternarEstado={alternarEstado}
      onEliminar={eliminar}
      onRenombrarSeccion={renombrarSeccion}
      onEliminarSeccion={eliminarSeccion}
      onDescargarPdf={descargarPdf}
    />
  );
};

// Necesario para que NocoBase aplique x-use-component-props (opciones del bloque).
export const OdontogramaBlock = withDynamicSchemaProps(OdontogramaBlockBase, { displayName: 'OdontogramaBlock' });
