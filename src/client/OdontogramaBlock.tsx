import { DeleteOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Odontograma } from '@gransalud/odontograma-react';
import {
  useAPIClient,
  useCollection,
  useCollectionRecordData,
  useCurrentPopupRecord,
  useRequest,
  withDynamicSchemaProps,
} from '@nocobase/client';
import { App, Alert, Button, Col, Empty, InputNumber, Popconfirm, Row, Segmented, Select, Space, Spin, Statistic, Switch, Table, Tag, Typography } from 'antd';
import React, { useMemo, useRef, useState } from 'react';
import {
  CAMPOS_CATALOGO,
  CAMPOS_FICHA,
  CAMPOS_LINEA,
  CAMPOS_PLAN,
  COLECCION_CATALOGO,
  COLECCION_FICHA,
  COLECCION_LINEAS,
  COLECCION_PLAN,
  COLORES_POR_DEFECTO,
  ESTADOS,
  Estado,
  clp,
  fechaCL,
} from './constants';
import { ElegirPlan } from './ElegirPlan';
import {
  ALCANCES,
  ARCADAS,
  Alcance,
  BOCA,
  CUADRANTES,
  alcanceDeZona,
  dientesDeZona,
  etiquetaZona,
  ordenZona,
  tipoDeDiente,
  zonaAfectaDiente,
  zonaPorDefecto,
} from './zonas';

interface Prestacion {
  id: number;
  nombrePrestacion: string;
  alcance: Alcance;
  precio: number;
  color?: string;
}

interface Linea {
  id: number;
  zona: string;
  precio: number;
  estado: Estado;
  notas?: string;
  FK_prestacion?: number;
  prestacionAsociada?: Prestacion;
  FK_fichaDentalRealizacion?: number | null;
  fichaDentalRealizacion?: { id: number; fecha?: string } | null;
}

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

const ESPECIFICIDAD: Record<Alcance, number> = { boca: 0, arcada: 1, cuadrante: 2, diente: 3 };

const OdontogramaBlockBase: React.FC<OdontogramaBlockProps> = ({ readOnly = false }) => {
  const fichaId = useFichaDental();
  const api = useAPIClient();
  const { message } = App.useApp();
  const contenedor = useRef<HTMLDivElement>(null);

  const [diente, setDiente] = useState<string | null>(null);
  const [prestacionId, setPrestacionId] = useState<number | null>(null);
  const [zona, setZona] = useState<string | null>(null);
  const [precio, setPrecio] = useState<number | null>(null);
  const [soloDiente, setSoloDiente] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

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

  const catalogoReq = useRequest<{ data: Prestacion[] }>({
    resource: COLECCION_CATALOGO,
    action: 'list',
    params: {
      filter: { [CAMPOS_CATALOGO.activo]: true },
      paginate: false,
      sort: [CAMPOS_CATALOGO.nombre],
    },
  });

  const lineas = useMemo(
    () => [...(lineasReq.data?.data ?? [])].sort((a, b) => ordenZona(a.zona) - ordenZona(b.zona) || a.id - b.id),
    [lineasReq.data],
  );
  const catalogo = catalogoReq.data?.data ?? [];

  const colorDe = useMemo(() => {
    const colores = new Map<number, string>();
    const ids = Array.from(new Set(lineas.map((l) => l.FK_prestacion).filter(Boolean)));
    ids.forEach((id, i) => {
      const prestacion = lineas.find((l) => l.FK_prestacion === id)?.prestacionAsociada;
      colores.set(id, prestacion?.color || COLORES_POR_DEFECTO[i % COLORES_POR_DEFECTO.length]);
    });
    return (id?: number) => (id && colores.get(id)) || COLORES_POR_DEFECTO[0];
  }, [lineas]);

  // Cada diente toma el color de la zona más específica que lo afecta (diente > cuadrante > arcada).
  const dientesPintados = useMemo(() => {
    const pintados: Record<string, string> = {};
    [...lineas]
      .sort((a, b) => ESPECIFICIDAD[alcanceDeZona(a.zona) ?? 'boca'] - ESPECIFICIDAD[alcanceDeZona(b.zona) ?? 'boca'])
      .forEach((linea) => dientesDeZona(linea.zona).forEach((d) => (pintados[d] = colorDe(linea.FK_prestacion))));
    return pintados;
  }, [lineas, colorDe]);

  // Referencias de color de lo que está pintado en el dibujo (sin boca completa, que va aparte).
  const referencias = Array.from(
    new Map(lineas.filter((l) => l.zona !== BOCA).map((l) => [l.FK_prestacion, l.prestacionAsociada?.nombrePrestacion])),
  );

  const lineasBoca = lineas.filter((l) => l.zona === BOCA);
  const lineasVisibles = soloDiente && diente ? lineas.filter((l) => zonaAfectaDiente(l.zona, diente)) : lineas;

  const total = lineas.reduce((suma, l) => suma + (Number(l.precio) || 0), 0);
  const realizado = lineas.filter((l) => l.estado === 'realizado').reduce((suma, l) => suma + (Number(l.precio) || 0), 0);

  const prestacion = catalogo.find((p) => p.id === prestacionId);
  const alcance = prestacion?.alcance;
  const zonaEfectiva = alcance === 'diente' ? diente : zona;

  const elegirDiente = (nuevo: string) => {
    setDiente(nuevo);
    if (alcance && alcance !== 'diente' && alcance !== 'boca') setZona(zonaPorDefecto(alcance, nuevo));
  };

  const elegirPrestacion = (id: number) => {
    const elegida = catalogo.find((p) => p.id === id);
    setPrestacionId(id);
    setPrecio(elegida ? Number(elegida.precio) : null);
    setZona(elegida ? zonaPorDefecto(elegida.alcance, diente) : null);
  };

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

  const agregar = async () => {
    if (!prestacion || !zonaEfectiva || precio == null) return;
    setGuardando(true);
    await ejecutar(
      () =>
        api.resource(COLECCION_LINEAS).create({
          values: {
            [CAMPOS_LINEA.fkPlan]: planId,
            [CAMPOS_LINEA.fkPrestacion]: prestacion.id,
            [CAMPOS_LINEA.zona]: zonaEfectiva,
            [CAMPOS_LINEA.precio]: precio,
            [CAMPOS_LINEA.estado]: 'planificado',
          },
        }),
      `${prestacion.nombrePrestacion} agregada en ${etiquetaZona(zonaEfectiva).toLowerCase()}`,
    );
    setGuardando(false);
    setPrestacionId(null);
    setPrecio(null);
    setZona(null);
  };

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

  const asociarPlan = async (id: number) => {
    await api.resource(COLECCION_FICHA).update({ filterByTk: fichaId, values: { [CAMPOS_FICHA.fkPlan]: id } });
    await fichaReq.refresh();
  };

  const crearPlan = async () => {
    const respuesta = await api.resource(COLECCION_PLAN).create({ values: { [CAMPOS_PLAN.fkPaciente]: pacienteId } });
    await asociarPlan(respuesta?.data?.data?.id);
  };

  const eliminar = (linea: Linea) => ejecutar(() => api.resource(COLECCION_LINEAS).destroy({ filterByTk: linea.id }));

  const descargarPdf = async () => {
    setGenerandoPdf(true);
    try {
      // Sin selección, para que el diente seleccionado salga con su color en la imagen.
      if (diente) {
        setDiente(null);
        await new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(resolver)));
      }
      const { generarPresupuestoPdf } = await import('./pdf');
      const paciente = ficha?.[CAMPOS_FICHA.fichaClinica]?.[CAMPOS_FICHA.paciente] ?? {};
      const funcionario = ficha?.[CAMPOS_FICHA.fichaClinica]?.[CAMPOS_FICHA.funcionario] ?? {};
      const nombrePaciente =
        paciente.nombreCompleto || [paciente.nomPaciente, paciente.apellido1Pac, paciente.apellido2Pac].filter(Boolean).join(' ');
      const nombreFuncionario =
        funcionario.nombreCompleto || [funcionario.nombre, funcionario.primerApellido, funcionario.segundoApellido].filter(Boolean).join(' ');
      const { conImagen } = await generarPresupuestoPdf({
        paciente: nombrePaciente,
        rut: paciente.rutPaciente,
        profesional: nombreFuncionario,
        fechaAtencion: fechaCL(ficha?.[CAMPOS_FICHA.fecha]) || undefined,
        observaciones: ficha?.[CAMPOS_FICHA.observaciones],
        lineas: lineas.map((l) => ({
          zona: l.zona,
          prestacion: l.prestacionAsociada?.nombrePrestacion ?? '-',
          estado: l.estado,
          precio: Number(l.precio) || 0,
        })),
        svg: contenedor.current?.querySelector('svg'),
      });
      if (!conImagen) message.warning('El PDF se generó sin la imagen del odontograma.');
    } catch (error) {
      console.error('[odontograma] PDF', error);
      message.error('No se pudo generar el PDF.');
    } finally {
      setGenerandoPdf(false);
    }
  };

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

  const lineasDeDiente = (d: string) => lineas.filter((l) => zonaAfectaDiente(l.zona, d));

  const opcionesCatalogo = (Object.keys(ALCANCES) as Alcance[])
    .map((a) => ({
      label: ALCANCES[a],
      options: catalogo
        .filter((p) => p.alcance === a)
        .map((p) => ({ value: p.id, label: `${p.nombrePrestacion} · ${clp(p.precio)}` })),
    }))
    .filter((grupo) => grupo.options.length);

  const columnas = [
    { title: 'Zona', dataIndex: 'zona', render: (z: string) => etiquetaZona(z) },
    { title: 'Prestación', render: (_: unknown, l: Linea) => l.prestacionAsociada?.nombrePrestacion ?? '-' },
    {
      title: 'Estado',
      dataIndex: 'estado',
      render: (estado: Estado, l: Linea) => (
        <>
          <Tag
            color={ESTADOS[estado]?.color}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
            onClick={readOnly ? undefined : () => alternarEstado(l)}
          >
            {ESTADOS[estado]?.etiqueta ?? estado}
          </Tag>
          {estado === 'realizado' && l.fichaDentalRealizacion && (
            <Typography.Text type="secondary">
              {l.fichaDentalRealizacion.fecha
                ? ` el ${fechaCL(l.fichaDentalRealizacion.fecha)}`
                : ` en la atención ${l.fichaDentalRealizacion.id}`}
            </Typography.Text>
          )}
        </>
      ),
    },
    { title: 'Precio', dataIndex: 'precio', align: 'right' as const, render: (p: number) => clp(p) },
    ...(readOnly
      ? []
      : [
          {
            title: '',
            width: 48,
            render: (_: unknown, l: Linea) => (
              <Popconfirm title="¿Eliminar esta prestación?" okText="Eliminar" cancelText="Cancelar" onConfirm={() => eliminar(l)}>
                <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Eliminar" />
              </Popconfirm>
            ),
          },
        ]),
  ];

  return (
    <Row gutter={[24, 16]} data-odontograma>
      <Col span={24}>
        <div ref={contenedor}>
          {lineasBoca.length > 0 && (
            <Space size={[4, 4]} wrap style={{ marginBottom: 8 }}>
              <Typography.Text type="secondary">Boca completa:</Typography.Text>
              {lineasBoca.map((l) => (
                <Tag key={l.id} color={colorDe(l.FK_prestacion)}>
                  {l.prestacionAsociada?.nombrePrestacion}
                </Tag>
              ))}
            </Space>
          )}
          {/* Siempre seleccionable, también en solo lectura, para consultar cada diente. */}
          <div style={{ width: '80%', margin: '0 auto' }}>
            <Odontograma
              dientesPintados={dientesPintados}
              dienteSeleccionado={diente}
              onSeleccionarDiente={elegirDiente}
              contenidoTooltip={(d) => (
                <div>
                  <strong>
                    {d} · {tipoDeDiente(d)}
                  </strong>
                  {lineasDeDiente(d).map((l) => (
                    <div key={l.id}>
                      {l.prestacionAsociada?.nombrePrestacion}
                      {l.zona !== d ? ` (${etiquetaZona(l.zona).toLowerCase()})` : ''}
                    </div>
                  ))}
                </div>
              )}
            />
          </div>
          {referencias.length > 0 && (
            <Space size={[4, 4]} wrap>
              {referencias.map(([id, nombre]) => (
                <Tag key={id} color={colorDe(id)}>
                  {nombre}
                </Tag>
              ))}
            </Space>
          )}
        </div>
      </Col>
      <Col span={24}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {diente ? `Diente ${diente} · ${tipoDeDiente(diente)}` : 'Selecciona un diente en el odontograma'}
          </Typography.Title>

          {!readOnly && (
            <Space wrap align="end">
              <Select
                style={{ minWidth: 260 }}
                placeholder="Prestación"
                showSearch
                optionFilterProp="label"
                loading={catalogoReq.loading}
                options={opcionesCatalogo}
                value={prestacionId}
                onChange={elegirPrestacion}
                notFoundContent="No hay prestaciones activas en el catálogo"
              />
              {alcance === 'cuadrante' && (
                <Segmented
                  value={zona}
                  onChange={(v) => setZona(String(v))}
                  options={Object.keys(CUADRANTES).map((c) => ({ value: c, label: c, title: CUADRANTES[c] }))}
                />
              )}
              {alcance === 'arcada' && (
                <Segmented
                  value={zona}
                  onChange={(v) => setZona(String(v))}
                  options={Object.entries(ARCADAS).map(([value, label]) => ({ value, label }))}
                />
              )}
              <InputNumber
                placeholder="Precio"
                min={0}
                step={1000}
                value={precio}
                onChange={(v) => setPrecio(v == null ? null : Number(v))}
                formatter={(v) => (v == null || v === '' ? '' : clp(v as number))}
                parser={(v) => Number((v ?? '').replace(/\D/g, ''))}
                style={{ width: 140 }}
              />
              <Button type="primary" icon={<PlusOutlined />} loading={guardando} disabled={!prestacion || !zonaEfectiva || precio == null} onClick={agregar}>
                Agregar
              </Button>
            </Space>
          )}
          {!readOnly && alcance === 'diente' && !diente && (
            <Typography.Text type="warning">Selecciona el diente en el odontograma para agregar esta prestación.</Typography.Text>
          )}

          <Space>
            <Switch size="small" checked={soloDiente} disabled={!diente} onChange={setSoloDiente} />
            <Typography.Text>Filtrar solo lo que afecta al diente seleccionado</Typography.Text>
          </Space>

          <Table
            rowKey="id"
            size="small"
            pagination={false}
            loading={lineasReq.loading}
            dataSource={lineasVisibles}
            columns={columnas}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin prestaciones" /> }}
            onRow={(l) => ({ style: diente && zonaAfectaDiente(l.zona, diente) ? { background: 'rgba(22, 119, 255, 0.06)' } : undefined })}
          />

          <Row gutter={16} align="middle">
            <Col>
              <Statistic title="Planificado" value={clp(total - realizado)} />
            </Col>
            <Col>
              <Statistic title="Realizado" value={clp(realizado)} />
            </Col>
            <Col>
              <Statistic title="Total" value={clp(total)} valueStyle={{ fontWeight: 600 }} />
            </Col>
            <Col flex="auto" style={{ textAlign: 'right' }}>
              <Button icon={<FilePdfOutlined />} loading={generandoPdf} disabled={!lineas.length} onClick={descargarPdf}>
                Descargar presupuesto (PDF)
              </Button>
            </Col>
          </Row>
        </Space>
      </Col>
    </Row>
  );
};

// Necesario para que NocoBase aplique x-use-component-props (opciones del bloque).
export const OdontogramaBlock = withDynamicSchemaProps(OdontogramaBlockBase, { displayName: 'OdontogramaBlock' });
