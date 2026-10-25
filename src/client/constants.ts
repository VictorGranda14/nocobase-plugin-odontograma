export const BLOCK_NAME = 'OdontogramaBlock';
export const BLOCK_KEY = 'odontograma';
export const BLOCK_SETTINGS_NAME = 'blockSettings:odontograma';

// Colecciones creadas desde la interfaz de NocoBase (ver README).
export const COLECCION_FICHA = 'fichaDental';
export const COLECCION_LINEAS = 'prestacionesFichaDental';
export const COLECCION_CATALOGO = 'prestacionesDentales';

export const CAMPOS_FICHA = {
  fecha: 'fecha',
  observaciones: 'observaciones',
  fichaClinica: 'fichaClinicaAsociada',
  paciente: 'pacienteAsociado',
  funcionario: 'funcionarioAsociado',
};

export const CAMPOS_LINEA = {
  fkFicha: 'FK_fichaDental',
  fkPrestacion: 'FK_prestacion',
  prestacion: 'prestacionAsociada',
  zona: 'zona',
  precio: 'precio',
  estado: 'estado',
  notas: 'notas',
};

export const CAMPOS_CATALOGO = {
  nombre: 'nombrePrestacion',
  alcance: 'alcance',
  precio: 'precio',
  color: 'color',
  activo: 'activo',
};

export const ESTADOS = {
  planificado: { etiqueta: 'Planificado', color: 'blue' },
  realizado: { etiqueta: 'Realizado', color: 'green' },
} as const;

export type Estado = keyof typeof ESTADOS;

export const PDF_TITULO = 'GranSalud - Presupuesto dental';
export const PDF_NOTA_VALIDEZ =
  'Presupuesto válido por 30 días desde su emisión. Los valores pueden variar según la evolución clínica del paciente.';

// Colores para prestaciones sin color definido en el catálogo.
export const COLORES_POR_DEFECTO = ['#1677ff', '#fa8c16', '#52c41a', '#eb2f96', '#722ed1', '#13c2c2', '#fadb14', '#f5222d'];

const formatoCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export const clp = (valor: number | string | null | undefined) => formatoCLP.format(Number(valor) || 0);
