// Zonas de la boca en notación FDI (solo dentición permanente).
//   Diente:    '11' … '48'
//   Cuadrante: 'C1' (sup. derecho), 'C2' (sup. izquierdo), 'C3' (inf. izquierdo), 'C4' (inf. derecho)
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

export const DIENTES = [1, 2, 3, 4].flatMap((cuadrante) => POSICIONES.map((posicion) => `${cuadrante}${posicion}`));

const ES_DIENTE = /^[1-4][1-8]$/;
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
      return POSICIONES.map((posicion) => `${zona[1]}${posicion}`);
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

export const cuadranteDeDiente = (diente: string) => `C${diente[0]}` as keyof typeof CUADRANTES;

export const arcadaDeDiente = (diente: string) => (diente[0] === '1' || diente[0] === '2' ? 'AS' : 'AI');

export const tipoDeDiente = (diente: string) => TIPOS_DIENTE[Number(diente[1]) - 1] ?? '';

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
