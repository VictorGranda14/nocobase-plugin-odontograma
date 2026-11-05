import { Button, Select } from 'antd';
import React, { useState } from 'react';
import { clp } from './constants';
import { Prestacion } from './tipos';
import { ALCANCES, Alcance } from './zonas';

interface SelectorPrestacionProps {
  catalogo: Prestacion[];
  cargando?: boolean;
  value: number | null;
  onChange: (id: number) => void;
}

const FILA: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, height: 'auto', minHeight: 40, textAlign: 'left', whiteSpace: 'normal' };

// Desplegable de prestaciones en dos columnas: alcances a la izquierda y las prestaciones del alcance marcado
// a la derecha. Al escribir, muestra la lista de coincidencias de todo el catálogo.
export const SelectorPrestacion: React.FC<SelectorPrestacionProps> = ({ catalogo, cargando, value, onChange }) => {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [alcanceMarcado, setAlcanceMarcado] = useState<Alcance | null>(null);
  // Con él se vuelve a abrir, aunque se haya marcado otro alcance sin elegir nada.
  const [ultimoAlcance, setUltimoAlcance] = useState<Alcance | null>(null);

  const cambiarAbierto = (abrir: boolean) => {
    setAbierto(abrir);
    if (abrir) setAlcanceMarcado(ultimoAlcance);
    else setBusqueda('');
  };

  const elegir = (id: number) => {
    // Con la misma prestación no se avisa: se conserva el precio editado.
    if (id !== value) onChange(id);
    setUltimoAlcance(catalogo.find((p) => p.id === id)?.alcance ?? null);
    cambiarAbierto(false);
  };

  // Una prestación con un alcance retirado (los cuadrantes) no se ofrece.
  const vigentes = catalogo.filter((p) => ALCANCES[p.alcance]);
  const alcances = (Object.keys(ALCANCES) as Alcance[]).filter((a) => vigentes.some((p) => p.alcance === a));
  const marcado = alcances.includes(alcanceMarcado) ? alcanceMarcado : alcances[0];

  const opciones = vigentes.map((p) => ({ value: p.id, label: p.nombrePrestacion, detalle: `${ALCANCES[p.alcance]} · ${clp(p.precio)}` }));

  const columnas = (
    // Sin esto, el clic le quitaría el foco al buscador y ya no se podría escribir.
    <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', maxHeight: 280 }} onMouseDown={(e) => e.preventDefault()}>
      <div style={{ overflowY: 'auto', borderRight: '1px solid #f0f0f0' }}>
        {alcances.map((a) => (
          <Button key={a} data-alcance block type="text" aria-pressed={a === marcado} style={{ ...FILA, fontWeight: a === marcado ? 600 : 400, background: a === marcado ? '#e6f4ff' : undefined }} onClick={() => setAlcanceMarcado(a)}>
            {ALCANCES[a]}
          </Button>
        ))}
      </div>
      <div style={{ overflowY: 'auto' }}>
        {vigentes
          .filter((p) => p.alcance === marcado)
          .map((p) => (
            <Button key={p.id} data-prestacion block type="text" aria-pressed={p.id === value} style={{ ...FILA, fontWeight: p.id === value ? 600 : 400, background: p.id === value ? '#e6f4ff' : undefined }} onClick={() => elegir(p.id)}>
              <span>{p.nombrePrestacion}</span>
              <span>{clp(p.precio)}</span>
            </Button>
          ))}
      </div>
    </div>
  );

  return (
    <Select
      style={{ width: 260 }}
      placeholder="Prestación"
      popupMatchSelectWidth={520}
      showSearch
      optionFilterProp="label"
      loading={cargando}
      options={opciones}
      labelRender={({ value: id, label }) => {
        const elegida = catalogo.find((p) => p.id === id);
        return elegida ? `${elegida.nombrePrestacion} · ${ALCANCES[elegida.alcance]}` : label;
      }}
      optionRender={(opcion) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opcion.label}</span>
          <span style={{ flex: 'none', color: '#595959', fontSize: 12 }}>{opcion.data.detalle}</span>
        </div>
      )}
      value={value}
      onChange={elegir}
      open={abierto}
      onDropdownVisibleChange={cambiarAbierto}
      // Escape lo atiende la lista de antd, que no está montada mientras se ven las columnas.
      // No debe llegar al drawer del formulario, que también se cierra con esa tecla.
      onKeyDown={(e) => {
        if (e.key === 'Escape' && abierto) {
          e.stopPropagation();
          cambiarAbierto(false);
        }
      }}
      searchValue={busqueda}
      onSearch={setBusqueda}
      dropdownRender={(lista) => (busqueda || !vigentes.length ? lista : columnas)}
      notFoundContent={vigentes.length ? 'Sin resultados' : 'No hay prestaciones activas en el catálogo'}
    />
  );
};
