// Zonas de la boca en notación FDI.
//   Diente:    '11' … '48' (permanentes), '51' … '85' (temporales)
//   Cuadrante: 'C1' (sup. derecho), 'C2' (sup. izquierdo), 'C3' (inf. izquierdo), 'C4' (inf. derecho),
//              cada uno con sus dientes temporales (cuadrantes FDI 5, 6, 7 y 8)
//   Arcada:    'AS' (superior, C1 + C2), 'AI' (inferior, C3 + C4)
//   Boca:      'BOCA'

export type Alcance = 'diente' | 'cuadrante' | 'arcada' | 'boca';

export const ALCANCES: Record<Alcance, string> = {
  diente: 'Por diente',
  cuadrante: 'Por cuadrante',
  arcada: 'Por arcada',
  boca: 'Boca completa',
};

const POSICIONES = [1, 2, 3, 4, 5, 6, 7, 8];

const TIPOS_DIENTE = [
  'Incisivo central',
  'Incisivo lateral',
  'Canino',
  'Primer premolar',
  'Segundo premolar',
  'Primer molar',
  'Segundo molar',
  'Tercer molar',
];

const TIPOS_DIENTE_TEMPORAL = ['Incisivo central', 'Incisivo lateral', 'Canino', 'Primer molar', 'Segundo molar'];

export const CUADRANTES = {
  C1: 'Cuadrante 1 · sup. derecho',
  C2: 'Cuadrante 2 · sup. izquierdo',
  C3: 'Cuadrante 3 · inf. izquierdo',
  C4: 'Cuadrante 4 · inf. derecho',
} as const;

export const ARCADAS = {
  AS: 'Arcada superior',
  AI: 'Arcada inferior',
} as const;

export const BOCA = 'BOCA';

const ES_DIENTE = /^([1-4][1-8]|[5-8][1-5])$/;

const esTemporal = (diente: string) => Number(diente[0]) >= 5;

// Cuadrante permanente del mismo lado de la boca: los temporales 5–8 equivalen a 1–4.
const cuadrante = (diente: string) => ((Number(diente[0]) - 1) % 4) + 1;

const temporalesDe = (cuadranteTemporal: number) => [1, 2, 3, 4, 5].map((posicion) => `${cuadranteTemporal}${posicion}`);
const ES_CUADRANTE = /^C[1-4]$/;

export function alcanceDeZona(zona: string): Alcance | null {
  if (ES_DIENTE.test(zona)) return 'diente';
  if (ES_CUADRANTE.test(zona)) return 'cuadrante';
  if (zona === 'AS' || zona === 'AI') return 'arcada';
  if (zona === BOCA) return 'boca';
  return null;
}

export function dientesDeZona(zona: string): string[] {
  switch (alcanceDeZona(zona)) {
    case 'diente':
      return [zona];
    case 'cuadrante':
      // Sus dientes permanentes y los temporales del mismo lado (C1 → 51–55, …, C4 → 81–85).
      return [...POSICIONES.map((posicion) => `${zona[1]}${posicion}`), ...temporalesDe(Number(zona[1]) + 4)];
    case 'arcada':
      return zona === 'AS' ? [...dientesDeZona('C1'), ...dientesDeZona('C2')] : [...dientesDeZona('C3'), ...dientesDeZona('C4')];
    default:
      return [];
  }
}

export function etiquetaZona(zona: string): string {
  switch (alcanceDeZona(zona)) {
    case 'diente':
      return `Diente ${zona}`;
    case 'cuadrante':
      return CUADRANTES[zona];
    case 'arcada':
      return ARCADAS[zona];
    case 'boca':
      return 'Boca completa';
    default:
      return zona || '-';
  }
}

// Boca → arcadas → cuadrantes → dientes; dentro de cada grupo, por número.
export function ordenZona(zona: string): number {
  switch (alcanceDeZona(zona)) {
    case 'boca':
      return 0;
    case 'arcada':
      return zona === 'AS' ? 1 : 2;
    case 'cuadrante':
      return 2 + Number(zona[1]);
    case 'diente':
      return 10 + Number(zona);
    default:
      return 1000;
  }
}

export const cuadranteDeDiente = (diente: string) => `C${cuadrante(diente)}` as keyof typeof CUADRANTES;

export const arcadaDeDiente = (diente: string) => (cuadrante(diente) <= 2 ? 'AS' : 'AI');

export const tipoDeDiente = (diente: string) =>
  (esTemporal(diente) ? TIPOS_DIENTE_TEMPORAL : TIPOS_DIENTE)[Number(diente[1]) - 1] ?? '';

// Denticiones que salen en el PDF: las que tienen prestaciones por diente o cuadrante propias
// (arcada y boca no cuentan); si no hay ninguna, la permanente.
export function denticionesConPrestaciones(lineas: { zona: string }[]): ('permanente' | 'temporal')[] {
  const propias = lineas.filter((l) => alcanceDeZona(l.zona) === 'diente' || alcanceDeZona(l.zona) === 'cuadrante');
  const temporal = propias.some((l) => alcanceDeZona(l.zona) === 'diente' && esTemporal(l.zona));
  const permanente = propias.some((l) => alcanceDeZona(l.zona) === 'cuadrante' || !esTemporal(l.zona));
  if (!temporal) return ['permanente'];
  return permanente ? ['permanente', 'temporal'] : ['temporal'];
}

export function zonaAfectaDiente(zona: string, diente: string): boolean {
  return zona === BOCA || dientesDeZona(zona).includes(diente);
}

// Zona por defecto para una prestación según el diente seleccionado.
export function zonaPorDefecto(alcance: Alcance, diente?: string | null): string | null {
  switch (alcance) {
    case 'diente':
      return diente ?? null;
    case 'cuadrante':
      return diente ? cuadranteDeDiente(diente) : 'C1';
    case 'arcada':
      return diente ? arcadaDeDiente(diente) : 'AS';
    case 'boca':
      return BOCA;
  }
}
