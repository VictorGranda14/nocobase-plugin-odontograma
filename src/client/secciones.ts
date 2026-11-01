import { ordenZona } from './zonas';

export interface GrupoSeccion<T> {
  nombre: string | null; // null: «Sin sección»
  lineas: T[];
  subtotal: number;
}

export const SIN_SECCION = 'Sin sección';

// Agrupa las prestaciones por sección. Recibe las líneas en orden de creación: las secciones salen en ese
// orden (las sin sección al final) y, dentro de cada una, las líneas se ordenan por zona.
export function agruparPorSeccion<T extends { zona: string; precio: number; seccion?: string | null }>(lineas: T[]): GrupoSeccion<T>[] {
  const grupos = new Map<string | null, T[]>();
  lineas.forEach((linea) => {
    const nombre = linea.seccion?.trim() || null;
    if (!grupos.has(nombre)) grupos.set(nombre, []);
    grupos.get(nombre).push(linea);
  });
  const ordenadas = (grupo: T[]) =>
    grupo.map((l, i) => [l, i] as const).sort(([a, i], [b, j]) => ordenZona(a.zona) - ordenZona(b.zona) || i - j).map(([l]) => l);
  const resultado = Array.from(grupos.entries()).map(([nombre, grupo]) => ({
    nombre,
    lineas: ordenadas(grupo),
    subtotal: grupo.reduce((suma, l) => suma + (Number(l.precio) || 0), 0),
  }));
  return [...resultado.filter((g) => g.nombre !== null), ...resultado.filter((g) => g.nombre === null)];
}

export const nombresDeSecciones = (lineas: { seccion?: string | null }[]) =>
  Array.from(new Set(lineas.map((l) => l.seccion?.trim()).filter(Boolean)));
