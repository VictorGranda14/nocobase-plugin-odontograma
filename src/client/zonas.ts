// Zonas de la boca en notación FDI.
//   Diente:    '11' … '48' (permanentes), '51' … '85' (temporales)
//   Sextante:  'S1' … 'S6', con sus dientes permanentes y temporales
//   Arcada:    'AS' (superior), 'AI' (inferior), con sus dientes permanentes y temporales
//   Boca:      'BOCA'

export type Alcance = 'diente' | 'sextante' | 'arcada' | 'boca';

export const ALCANCES: Record<Alcance, string> = {
  diente: 'Por diente',
  sextante: 'Por sextante',
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

const ARCADAS = {
  AS: 'Arcada superior',
  AI: 'Arcada inferior',
} as const;

export const BOCA = 'BOCA';

const ES_DIENTE = /^([1-4][1-8]|[5-8][1-5])$/;

const esTemporal = (diente: string) => Number(diente[0]) >= 5;

const arcadaSuperior = (diente: string) => [1, 2, 5, 6].includes(Number(diente[0]));

// Dientes de los dos lados de una arcada: permanentes (primer dígito 1–4) y temporales (5–8).
const dientesDeArcada = (permanentes: number[], temporales: number[]) => [
  ...permanentes.flatMap((lado) => POSICIONES.map((posicion) => `${lado}${posicion}`)),
  ...temporales.flatMap((lado) => [1, 2, 3, 4, 5].map((posicion) => `${lado}${posicion}`)),
];

const ES_SEXTANTE = /^S[1-6]$/;

const DIENTES_DE_SEXTANTE: Record<string, string[]> = {
  S1: ['18', '17', '16', '15', '14', '55', '54'],
  S2: ['13', '12', '11', '21', '22', '23', '53', '52', '51', '61', '62', '63'],
  S3: ['24', '25', '26', '27', '28', '64', '65'],
  S4: ['38', '37', '36', '35', '34', '75', '74'],
  S5: ['33', '32', '31', '41', '42', '43', '73', '72', '71', '81', '82', '83'],
  S6: ['44', '45', '46', '47', '48', '84', '85'],
};

export function alcanceDeZona(zona: string): Alcance | null {
  if (ES_DIENTE.test(zona)) return 'diente';
  if (ES_SEXTANTE.test(zona)) return 'sextante';
  if (zona === 'AS' || zona === 'AI') return 'arcada';
  if (zona === BOCA) return 'boca';
  return null;
}

function dientesDeZona(zona: string): string[] {
  switch (alcanceDeZona(zona)) {
    case 'diente':
      return [zona];
    case 'sextante':
      return DIENTES_DE_SEXTANTE[zona];
    case 'arcada':
      return zona === 'AS' ? dientesDeArcada([1, 2], [5, 6]) : dientesDeArcada([3, 4], [7, 8]);
    default:
      return [];
  }
}

export function etiquetaZona(zona: string): string {
  switch (alcanceDeZona(zona)) {
    case 'diente':
      return `Diente ${zona}`;
    case 'sextante':
      return `Sextante ${zona[1]}`;
    case 'arcada':
      return ARCADAS[zona];
    case 'boca':
      return 'Boca completa';
    default:
      return zona || '-';
  }
}

// Las caras de un diente: la opuesta a la vestibular depende de la arcada.
export const carasDelDiente = (diente: string) => ['Vestibular', arcadaSuperior(diente) ? 'Palatino' : 'Lingual', 'Mesial', 'Distal', 'Oclusal'];

export const carasDeLinea = (caras?: string | null) => (caras ? caras.split(',') : []);

// La zona de una línea con sus caras, por ejemplo «Diente 16 · Mesial · Oclusal».
export const etiquetaLinea = ({ zona, caras }: { zona: string; caras?: string | null }) =>
  [etiquetaZona(zona), ...carasDeLinea(caras)].join(' · ');

// Boca → arcadas → sextantes → dientes; dentro de cada grupo, por número.
export function ordenZona(zona: string): number {
  switch (alcanceDeZona(zona)) {
    case 'boca':
      return 0;
    case 'arcada':
      return zona === 'AS' ? 1 : 2;
    case 'sextante':
      return 2 + Number(zona[1]);
    case 'diente':
      return 10 + Number(zona);
    default:
      return 1000;
  }
}

export const tipoDeDiente = (diente: string) =>
  (esTemporal(diente) ? TIPOS_DIENTE_TEMPORAL : TIPOS_DIENTE)[Number(diente[1]) - 1] ?? '';

// Denticiones que salen en el PDF: las que tienen prestaciones por diente propias
// (sextante, arcada y boca no cuentan); si no hay ninguna, la permanente.
export function denticionesConPrestaciones(lineas: { zona: string }[]): ('permanente' | 'temporal')[] {
  const propias = lineas.filter((l) => alcanceDeZona(l.zona) === 'diente');
  const temporal = propias.some((l) => esTemporal(l.zona));
  const permanente = propias.some((l) => !esTemporal(l.zona));
  if (!temporal) return ['permanente'];
  return permanente ? ['permanente', 'temporal'] : ['temporal'];
}

// Si una línea en `zona` abarca lo seleccionado (un diente, un sextante, una arcada o la boca).
export function zonaAfecta(zona: string, seleccion: string): boolean {
  return zona === BOCA || zona === seleccion || dientesDeZona(zona).includes(seleccion);
}
