import { DeleteOutlined } from '@ant-design/icons';
import { Button, Empty, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import React from 'react';
import { ESTADOS, Estado, clp, fechaCL } from './constants';
import { SIN_SECCION, agruparPorSeccion } from './secciones';
import { Linea } from './tipos';
import { etiquetaZona, zonaAfectaDiente } from './zonas';

interface TablaPrestacionesProps {
  lineas: Linea[]; // en orden de creación
  filtro?: (linea: Linea) => boolean; // filas visibles; los subtotales siguen contando todas
  diente: string | null;
  readOnly: boolean;
  cargando?: boolean;
  onAlternarEstado: (linea: Linea) => void;
  onEliminar: (linea: Linea) => void;
}

// Detalle del plan agrupado por sección, con su subtotal; resalta las filas que afectan al diente seleccionado.
export const TablaPrestaciones: React.FC<TablaPrestacionesProps> = ({ lineas, filtro, diente, readOnly, cargando, onAlternarEstado, onEliminar }) => {
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
            onClick={readOnly ? undefined : () => onAlternarEstado(l)}
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
              <Popconfirm title="¿Eliminar esta prestación?" okText="Eliminar" cancelText="Cancelar" onConfirm={() => onEliminar(l)}>
                <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Eliminar" />
              </Popconfirm>
            ),
          },
        ]),
  ];

  const tabla = (filas: Linea[]) => (
    <Table
      rowKey="id"
      size="small"
      pagination={false}
      loading={cargando}
      dataSource={filtro ? filas.filter(filtro) : filas}
      columns={columnas}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin prestaciones" /> }}
      onRow={(l) => ({ style: diente && zonaAfectaDiente(l.zona, diente) ? { background: 'rgba(22, 119, 255, 0.06)' } : undefined })}
    />
  );

  const grupos = agruparPorSeccion(lineas);
  // Sin secciones, la tabla es una sola, como antes de existir las secciones.
  if (grupos.every((g) => g.nombre === null)) return tabla(grupos[0]?.lineas ?? []);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {grupos.map((grupo) => (
        <div key={grupo.nombre ?? ''} data-seccion={grupo.nombre ?? ''}>
          <Space style={{ marginBottom: 4 }}>
            <Typography.Text strong>{grupo.nombre ?? SIN_SECCION}</Typography.Text>
            <Typography.Text type="secondary">
              Subtotal <span data-subtotal>{clp(grupo.subtotal)}</span>
            </Typography.Text>
          </Space>
          {tabla(grupo.lineas)}
        </div>
      ))}
    </Space>
  );
};
