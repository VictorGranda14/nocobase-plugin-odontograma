import { Denticion, Odontograma } from '@gransalud/odontograma-react';
import { Tabs } from 'antd';
import React, { useMemo, useState } from 'react';
import { coloresDePrestaciones } from './colores';
import { Linea } from './tipos';
import { Alcance, alcanceDeZona, dientesDeZona, etiquetaZona, tipoDeDiente, zonaAfecta } from './zonas';

const ESPECIFICIDAD: Record<Alcance, number> = { boca: 0, arcada: 1, cuadrante: 2, diente: 3 };

// Arcadas y boca pintan solo su selector; cuadrantes y dientes, sus piezas.
const zonasQuePinta = (zona: string) => {
  const alcance = alcanceDeZona(zona);
  return alcance === 'arcada' || alcance === 'boca' ? [zona] : dientesDeZona(zona);
};

interface DibujoPlanProps {
  lineas: Linea[];
  zona: string | null;
  onSeleccionarZona: (zona: string) => void;
  // Denticiones que se dibujan fuera de pantalla, sin selección, para capturarlas en el PDF.
  capturar?: Denticion[];
}

// Odontograma pintado con las prestaciones del plan.
export const DibujoPlan: React.FC<DibujoPlanProps> = ({ lineas, zona, onSeleccionarZona, capturar = [] }) => {
  const [denticion, setDenticion] = useState<Denticion>('permanente');
  const colorDe = useMemo(() => coloresDePrestaciones(lineas), [lineas]);

  // Cada diente toma el color de la zona más específica que lo afecta (diente > cuadrante); cada selector, el de su última prestación.
  const zonasPintadas = useMemo(() => {
    const pintados: Record<string, string> = {};
    [...lineas]
      .sort((a, b) => ESPECIFICIDAD[alcanceDeZona(a.zona) ?? 'boca'] - ESPECIFICIDAD[alcanceDeZona(b.zona) ?? 'boca'])
      .forEach((linea) => zonasQuePinta(linea.zona).forEach((z) => (pintados[z] = colorDe(linea.FK_prestacion))));
    return pintados;
  }, [lineas, colorDe]);

  const lineasDeDiente = (d: string) => lineas.filter((l) => zonaAfecta(l.zona, d));

  const tooltip = (z: string) =>
    alcanceDeZona(z) === 'diente' ? (
      <div>
        <strong>
          {z} · {tipoDeDiente(z)}
        </strong>
        {lineasDeDiente(z).map((l, i) => (
          <div key={i}>
            {l.prestacionAsociada?.nombrePrestacion}
            {l.zona !== z ? ` (${etiquetaZona(l.zona).toLowerCase()})` : ''}
          </div>
        ))}
      </div>
    ) : (
      <div>
        <strong>{etiquetaZona(z)}</strong>
        {lineas
          .filter((l) => l.zona === z)
          .map((l, i) => (
            <div key={i}>{l.prestacionAsociada?.nombrePrestacion}</div>
          ))}
      </div>
    );

  return (
    <>
      <Tabs
        activeKey={denticion}
        onChange={(clave) => setDenticion(clave as Denticion)}
        items={[
          { key: 'permanente', label: 'Permanente' },
          { key: 'temporal', label: 'Temporal' },
        ]}
      />
      {/* Siempre seleccionable, también en solo lectura, para consultar cada zona. */}
      <div style={{ width: '80%', margin: '0 auto' }}>
        <Odontograma
          denticion={denticion}
          zonasPintadas={zonasPintadas}
          zonaSeleccionada={zona}
          onSeleccionarZona={onSeleccionarZona}
          contenidoTooltip={tooltip}
        />
      </div>
      {capturar.length > 0 && (
        <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, width: 800 }}>
          {capturar.map((d) => (
            <div key={d} data-captura-pdf={d}>
              <Odontograma denticion={d} zonasPintadas={zonasPintadas} />
            </div>
          ))}
        </div>
      )}
    </>
  );
};
