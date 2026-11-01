import { DeleteOutlined } from '@ant-design/icons';
import { Button, Empty, Popconfirm, Table, Tag, Typography } from 'antd';
import React from 'react';
import { ESTADOS, Estado, clp, fechaCL } from './constants';
import { Linea } from './tipos';
import { etiquetaZona, zonaAfectaDiente } from './zonas';

interface TablaPrestacionesProps {
  lineas: Linea[];
  diente: string | null;
  readOnly: boolean;
  cargando?: boolean;
  onAlternarEstado: (linea: Linea) => void;
  onEliminar: (linea: Linea) => void;
}

// Detalle del plan; resalta las filas que afectan al diente seleccionado.
export const TablaPrestaciones: React.FC<TablaPrestacionesProps> = ({ lineas, diente, readOnly, cargando, onAlternarEstado, onEliminar }) => {
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

  return (
    <Table
      rowKey="id"
      size="small"
      pagination={false}
      loading={cargando}
      dataSource={lineas}
      columns={columnas}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin prestaciones" /> }}
      onRow={(l) => ({ style: diente && zonaAfectaDiente(l.zona, diente) ? { background: 'rgba(22, 119, 255, 0.06)' } : undefined })}
    />
  );
};
