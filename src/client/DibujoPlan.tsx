import { Odontograma } from '@gransalud/odontograma-react';
import { Space, Tag, Typography } from 'antd';
import React, { useMemo } from 'react';
import { COLORES_POR_DEFECTO } from './constants';
import { Linea } from './tipos';
import { Alcance, BOCA, alcanceDeZona, dientesDeZona, etiquetaZona, tipoDeDiente, zonaAfectaDiente } from './zonas';

const ESPECIFICIDAD: Record<Alcance, number> = { boca: 0, arcada: 1, cuadrante: 2, diente: 3 };

interface DibujoPlanProps {
  lineas: Linea[];
  diente: string | null;
  onSeleccionarDiente: (diente: string) => void;
}

// Odontograma pintado con las prestaciones del plan, con las de boca completa arriba y las referencias abajo.
export const DibujoPlan: React.FC<DibujoPlanProps> = ({ lineas, diente, onSeleccionarDiente }) => {
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
  const lineasDeDiente = (d: string) => lineas.filter((l) => zonaAfectaDiente(l.zona, d));

  return (
    <>
      {lineasBoca.length > 0 && (
        <Space size={[4, 4]} wrap style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary">Boca completa:</Typography.Text>
          {lineasBoca.map((l, i) => (
            <Tag key={i} color={colorDe(l.FK_prestacion)}>
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
          onSeleccionarDiente={onSeleccionarDiente}
          contenidoTooltip={(d) => (
            <div>
              <strong>
                {d} · {tipoDeDiente(d)}
              </strong>
              {lineasDeDiente(d).map((l, i) => (
                <div key={i}>
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
    </>
  );
};
