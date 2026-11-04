import { COLORES_POR_DEFECTO } from './constants';
import { Linea } from './tipos';

// Color de cada prestación del plan: el de su catálogo o, si no tiene, uno por defecto según su orden de aparición.
export function coloresDePrestaciones(lineas: Linea[]) {
  const colores = new Map<number, string>();
  const ids = Array.from(new Set(lineas.map((l) => l.FK_prestacion).filter(Boolean)));
  ids.forEach((id, i) => {
    const prestacion = lineas.find((l) => l.FK_prestacion === id)?.prestacionAsociada;
    colores.set(id, prestacion?.color || COLORES_POR_DEFECTO[i % COLORES_POR_DEFECTO.length]);
  });
  return (id?: number) => (id && colores.get(id)) || COLORES_POR_DEFECTO[0];
}
