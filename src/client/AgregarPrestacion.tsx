import { PlusOutlined } from '@ant-design/icons';
import { AutoComplete, Button, Input, InputNumber, Select, Space, Typography } from 'antd';
import React, { useState } from 'react';
import { clp } from './constants';
import { NuevaLinea, Prestacion } from './tipos';
import { ALCANCES, Alcance, BOCA, alcanceDeZona } from './zonas';

interface AgregarPrestacionProps {
  catalogo: Prestacion[];
  secciones: string[];
  cargando?: boolean;
  seleccion: string | null;
  caras: string[];
  onAgregar: (nueva: NuevaLinea) => Promise<void> | void;
}

const AVISOS = {
  diente: 'Selecciona el diente en el odontograma para agregar esta prestación.',
  sextante: 'Selecciona el sextante en el odontograma para agregar esta prestación.',
  arcada: 'Selecciona la arcada superior o inferior en el odontograma para agregar esta prestación.',
};

// Prestación del catálogo, zona según su alcance (la selección del dibujo; la boca, siempre) y precio.
export const AgregarPrestacion: React.FC<AgregarPrestacionProps> = ({ catalogo, secciones, cargando, seleccion, caras, onAgregar }) => {
  const [prestacionId, setPrestacionId] = useState<number | null>(null);
  const [precio, setPrecio] = useState<number | null>(null);
  // Se conserva entre una prestación y otra, para agregar varias a la misma sección.
  const [seccion, setSeccion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const prestacion = catalogo.find((p) => p.id === prestacionId);
  const alcance = prestacion?.alcance;
  const zonaDeLaSeleccion = seleccion && alcanceDeZona(seleccion) === alcance ? seleccion : null;
  const zonaEfectiva = alcance === 'boca' ? BOCA : zonaDeLaSeleccion;

  const elegirPrestacion = (id: number) => {
    const elegida = catalogo.find((p) => p.id === id);
    setPrestacionId(id);
    setPrecio(elegida ? Number(elegida.precio) : null);
  };

  const agregar = async () => {
    if (!prestacion || !zonaEfectiva || precio == null) return;
    setGuardando(true);
    try {
      await onAgregar({ prestacion, zona: zonaEfectiva, caras: alcance === 'diente' && caras.length ? caras.join(',') : null, precio, seccion: seccion.trim() || null });
    } finally {
      setGuardando(false);
    }
    setPrestacionId(null);
    setPrecio(null);
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
        {/* Escribir un nombre nuevo crea la sección; existe mientras tenga prestaciones. */}
        <AutoComplete
          style={{ minWidth: 200 }}
          value={seccion}
          onChange={(v) => setSeccion(v ?? '')}
          options={secciones.map((s) => ({ value: s }))}
          filterOption={(texto, opcion) => String(opcion?.value).toLowerCase().includes(texto.toLowerCase())}
        >
          <Input placeholder="Sección (opcional)" allowClear />
        </AutoComplete>
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
      {alcance && alcance !== 'boca' && !zonaDeLaSeleccion && <Typography.Text type="warning">{AVISOS[alcance]}</Typography.Text>}
    </>
  );
};
