import { PlusOutlined } from '@ant-design/icons';
import { Button, InputNumber, Segmented, Select, Space, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { clp } from './constants';
import { NuevaLinea, Prestacion } from './tipos';
import { ALCANCES, ARCADAS, Alcance, CUADRANTES, zonaPorDefecto } from './zonas';

interface AgregarPrestacionProps {
  catalogo: Prestacion[];
  cargando?: boolean;
  diente: string | null;
  onAgregar: (nueva: NuevaLinea) => Promise<void> | void;
}

// Prestación del catálogo, zona según su alcance (diente seleccionado, cuadrante, arcada o boca) y precio.
export const AgregarPrestacion: React.FC<AgregarPrestacionProps> = ({ catalogo, cargando, diente, onAgregar }) => {
  const [prestacionId, setPrestacionId] = useState<number | null>(null);
  const [zona, setZona] = useState<string | null>(null);
  const [precio, setPrecio] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  const prestacion = catalogo.find((p) => p.id === prestacionId);
  const alcance = prestacion?.alcance;
  const zonaEfectiva = alcance === 'diente' ? diente : zona;

  // Al elegir otro diente, el cuadrante o la arcada propuestos lo siguen.
  useEffect(() => {
    if (alcance && alcance !== 'diente' && alcance !== 'boca') setZona(zonaPorDefecto(alcance, diente));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diente]);

  const elegirPrestacion = (id: number) => {
    const elegida = catalogo.find((p) => p.id === id);
    setPrestacionId(id);
    setPrecio(elegida ? Number(elegida.precio) : null);
    setZona(elegida ? zonaPorDefecto(elegida.alcance, diente) : null);
  };

  const agregar = async () => {
    if (!prestacion || !zonaEfectiva || precio == null) return;
    setGuardando(true);
    try {
      await onAgregar({ prestacion, zona: zonaEfectiva, precio });
    } finally {
      setGuardando(false);
    }
    setPrestacionId(null);
    setPrecio(null);
    setZona(null);
  };

  const opcionesCatalogo = (Object.keys(ALCANCES) as Alcance[])
    .map((a) => ({
      label: ALCANCES[a],
      options: catalogo
        .filter((p) => p.alcance === a)
        .map((p) => ({ value: p.id, label: `${p.nombrePrestacion} · ${clp(p.precio)}` })),
    }))
    .filter((grupo) => grupo.options.length);

  return (
    <>
      <Space wrap align="end">
        <Select
          style={{ minWidth: 260 }}
          placeholder="Prestación"
          showSearch
          optionFilterProp="label"
          loading={cargando}
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
      {alcance === 'diente' && !diente && (
        <Typography.Text type="warning">Selecciona el diente en el odontograma para agregar esta prestación.</Typography.Text>
      )}
    </>
  );
};
