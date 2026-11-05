import { Button, Select, Space, Typography } from 'antd';
import React from 'react';
import { Alcance, alcanceDeZona, carasDelDiente, opcionesDeZona } from './zonas';

const ETIQUETAS: Partial<Record<Alcance, string>> = { diente: 'Pieza', sextante: 'Sextante', arcada: 'Arcada' };

interface ListaDeZonasProps {
  alcance: Alcance;
  seleccion: string | null;
  onSeleccionarZona: (zona: string) => void;
}

// Desplegable con buscador que reemplaza al dibujo oculto para elegir la zona de una prestación.
export const ListaDeZonas: React.FC<ListaDeZonasProps> = ({ alcance, seleccion, onSeleccionarZona }) => (
  <Select
    data-lista-zonas
    style={{ minWidth: 240 }}
    placeholder={ETIQUETAS[alcance]}
    showSearch
    optionFilterProp="buscar"
    options={opcionesDeZona(alcance)}
    value={seleccion && alcanceDeZona(seleccion) === alcance ? seleccion : null}
    onChange={onSeleccionarZona}
  />
);

interface CarasDeDienteProps {
  diente: string;
  caras: string[];
  onMarcarCara: (diente: string, cara: string) => void;
}

// Caras del diente elegido en la lista; sin ninguna marcada, la prestación queda en el diente completo.
export const CarasDeDiente: React.FC<CarasDeDienteProps> = ({ diente, caras, onMarcarCara }) => (
  <Space wrap style={{ display: 'flex', marginTop: 8 }}>
    <Typography.Text type="secondary">Caras (opcional)</Typography.Text>
    {carasDelDiente(diente).map((cara) => (
      <Button key={cara} size="small" type={caras.includes(cara) ? 'primary' : 'default'} aria-pressed={caras.includes(cara)} onClick={() => onMarcarCara(diente, cara)}>
        {cara}
      </Button>
    ))}
  </Space>
);
