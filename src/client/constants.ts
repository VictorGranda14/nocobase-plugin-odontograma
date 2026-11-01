export const BLOCK_NAME = 'OdontogramaBlock';
export const BLOCK_KEY = 'odontograma';
export const BLOCK_SETTINGS_NAME = 'blockSettings:odontograma';
export const CAMPO_PLAN_NAME = 'OdontogramaPlanField';
export const CAMPO_PLAN_SETTINGS_NAME = 'fieldSettings:odontogramaPlan';

// Colecciones creadas desde la interfaz de NocoBase (ver README).
export const COLECCION_FICHA = 'fichaDental';
export const COLECCION_PLAN = 'planesTratamiento';
export const COLECCION_LINEAS = 'prestacionesPlanTratamiento';
export const COLECCION_CATALOGO = 'prestacionesDentales';
export const COLECCION_PACIENTE = 'paciente';
export const COLECCION_FUNCIONARIO = 'funcionarioSalud';

export const CAMPOS_FICHA = {
  fecha: 'fecha',
  observaciones: 'observaciones',
  fichaClinica: 'fichaClinicaAsociada',
  fkPlan: 'FK_planTratamiento',
  plan: 'planTratamientoAsociado',
  paciente: 'pacienteAsociado',
  funcionario: 'funcionarioAsociado',
};

export const CAMPOS_FICHA_CLINICA = {
  fkPaciente: 'FK_paciente',
  paciente: 'pacienteAsociado',
  fkFuncionario: 'FK_funcionario',
  funcionario: 'funcionarioAsociado',
};

export const CAMPOS_PLAN = {
  fkPaciente: 'FK_paciente',
  lineas: 'prestacionesAsociadas',
};

export const CAMPOS_LINEA = {
  fkPlan: 'FK_planTratamiento',
  fkRealizacion: 'FK_fichaDentalRealizacion',
  realizacion: 'fichaDentalRealizacion',
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

// Fecha (YYYY-MM-DD) o fecha y hora ISO en formato chileno (31-10-2026).
export const fechaCL = (valor?: string | null) =>
  valor ? new Date(valor.length === 10 ? `${valor}T12:00:00` : valor).toLocaleDateString('es-CL') : '';
