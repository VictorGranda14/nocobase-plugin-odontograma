// Crea las colecciones del odontograma en una instancia NocoBase 1.x mediante su API,
// con las mismas definiciones que genera la interfaz. Omite las que ya existen.
//
// Uso:
//   NOCOBASE_URL=https://staging.ejemplo.cl NOCOBASE_EMAIL=... NOCOBASE_PASSWORD=... node scripts/crear-colecciones.mjs
//   (o NOCOBASE_TOKEN=<token de API> en lugar de email y contraseña)
//
// Requiere que ya exista la colección fichasClinicas.

const URL_BASE = (process.env.NOCOBASE_URL || 'http://localhost:13001').replace(/\/$/, '');

async function token() {
  if (process.env.NOCOBASE_TOKEN) return process.env.NOCOBASE_TOKEN;
  const respuesta = await fetch(`${URL_BASE}/api/auth:signIn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Authenticator': 'basic' },
    body: JSON.stringify({ account: process.env.NOCOBASE_EMAIL, password: process.env.NOCOBASE_PASSWORD }),
  });
  const cuerpo = await respuesta.json();
  if (!cuerpo?.data?.token) throw new Error(`No se pudo iniciar sesión: ${JSON.stringify(cuerpo)}`);
  return cuerpo.data.token;
}

let TOKEN;

async function api(accion, { params = {}, values } = {}) {
  const query = new URLSearchParams(params).toString();
  const respuesta = await fetch(`${URL_BASE}/api/${accion}${query ? `?${query}` : ''}`, {
    method: values ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: values ? JSON.stringify(values) : undefined,
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(`${accion}: ${respuesta.status} ${JSON.stringify(cuerpo)}`);
  return cuerpo.data;
}

// Campos de sistema que la interfaz añade a toda colección «general».
const camposSistema = () => [
  {
    name: 'id',
    type: 'bigInt',
    interface: 'integer',
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
    uiSchema: { type: 'number', title: '{{t("ID")}}', 'x-component': 'InputNumber', 'x-read-pretty': true },
  },
  {
    name: 'createdAt',
    type: 'date',
    interface: 'createdAt',
    field: 'createdAt',
    uiSchema: { type: 'datetime', title: '{{t("Created at")}}', 'x-component': 'DatePicker', 'x-component-props': {}, 'x-read-pretty': true },
  },
  {
    name: 'createdBy',
    type: 'belongsTo',
    interface: 'createdBy',
    target: 'users',
    foreignKey: 'createdById',
    targetKey: 'id',
    uiSchema: {
      type: 'object',
      title: '{{t("Created by")}}',
      'x-component': 'AssociationField',
      'x-component-props': { fieldNames: { value: 'id', label: 'nickname' } },
      'x-read-pretty': true,
    },
  },
  {
    name: 'updatedAt',
    type: 'date',
    interface: 'updatedAt',
    field: 'updatedAt',
    uiSchema: { type: 'string', title: '{{t("Last updated at")}}', 'x-component': 'DatePicker', 'x-component-props': {}, 'x-read-pretty': true },
  },
  {
    name: 'updatedBy',
    type: 'belongsTo',
    interface: 'updatedBy',
    target: 'users',
    foreignKey: 'updatedById',
    targetKey: 'id',
    uiSchema: {
      type: 'object',
      title: '{{t("Last updated by")}}',
      'x-component': 'AssociationField',
      'x-component-props': { fieldNames: { value: 'id', label: 'nickname' } },
      'x-read-pretty': true,
    },
  },
];

const texto = (name, title, extra = {}) => ({
  name,
  type: 'string',
  interface: 'input',
  uiSchema: { type: 'string', 'x-component': 'Input', title },
  ...extra,
});

const textoLargo = (name, title) => ({
  name,
  type: 'text',
  interface: 'textarea',
  uiSchema: { type: 'string', 'x-component': 'Input.TextArea', title },
});

const entero = (name, title, extra = {}) => ({
  name,
  type: 'bigInt',
  interface: 'integer',
  uiSchema: { type: 'number', 'x-component': 'InputNumber', 'x-component-props': { stringMode: true, step: '1' }, 'x-validator': 'integer', title },
  ...extra,
});

const seleccion = (name, title, opciones, extra = {}) => ({
  name,
  type: 'string',
  interface: 'select',
  uiSchema: { type: 'string', 'x-component': 'Select', enum: opciones, title },
  ...extra,
});

const muchosAUno = (name, title, target, foreignKey, inversa) => ({
  name,
  type: 'belongsTo',
  interface: 'm2o',
  target,
  foreignKey,
  targetKey: 'id',
  onDelete: 'SET NULL',
  uiSchema: { title, 'x-component': 'AssociationField', 'x-component-props': { multiple: false } },
  ...(inversa && {
    reverseField: {
      name: inversa.name,
      type: 'hasMany',
      interface: 'o2m',
      uiSchema: { title: inversa.title, 'x-component': 'AssociationField', 'x-component-props': { multiple: true } },
    },
  }),
});

const DIENTES = [1, 2, 3, 4].flatMap((c) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => `${c}${p}`));
const OPCIONES_ZONA = [
  { value: 'BOCA', label: 'Boca completa' },
  { value: 'AS', label: 'Arcada superior' },
  { value: 'AI', label: 'Arcada inferior' },
  { value: 'C1', label: 'Cuadrante 1 · sup. derecho' },
  { value: 'C2', label: 'Cuadrante 2 · sup. izquierdo' },
  { value: 'C3', label: 'Cuadrante 3 · inf. izquierdo' },
  { value: 'C4', label: 'Cuadrante 4 · inf. derecho' },
  ...DIENTES.map((d) => ({ value: d, label: d })),
];

const COLECCIONES = [
  {
    name: 'prestacionesDentales',
    title: 'Prestaciones dentales',
    fields: [
      texto('nombrePrestacion', 'Nombre de la prestación'),
      seleccion('alcance', 'Alcance', [
        { value: 'diente', label: 'Por diente', color: 'blue' },
        { value: 'cuadrante', label: 'Por cuadrante', color: 'cyan' },
        { value: 'arcada', label: 'Por arcada', color: 'purple' },
        { value: 'boca', label: 'Boca completa', color: 'orange' },
      ]),
      entero('precio', 'Precio (CLP)'),
      {
        name: 'color',
        type: 'string',
        interface: 'color',
        uiSchema: { type: 'string', 'x-component': 'ColorPicker', default: '#1677FF', title: 'Color en el odontograma' },
      },
      {
        name: 'activo',
        type: 'boolean',
        interface: 'checkbox',
        defaultValue: true,
        uiSchema: { type: 'boolean', 'x-component': 'Checkbox', title: 'Activo' },
      },
    ],
  },
  {
    name: 'fichaDental',
    title: 'Ficha dental',
    fields: [
      {
        name: 'fecha',
        type: 'dateOnly',
        interface: 'date',
        uiSchema: {
          type: 'string',
          'x-component': 'DatePicker',
          'x-component-props': { dateOnly: true, showTime: false, picker: 'date', dateFormat: 'DD/MM/YYYY' },
          title: 'Fecha',
        },
      },
      textoLargo('observaciones', 'Observaciones'),
      muchosAUno('fichaClinicaAsociada', 'Ficha Clinica Asociada', 'fichasClinicas', 'FK_fichaClinica', {
        name: 'fichasDentalesAsociadas',
        title: 'Fichas Dentales Asociadas',
      }),
    ],
  },
  {
    name: 'prestacionesFichaDental',
    title: 'Prestaciones de la ficha dental',
    fields: [
      muchosAUno('fichaDentalAsociada', 'Ficha Dental Asociada', 'fichaDental', 'FK_fichaDental', {
        name: 'prestacionesAsociadas',
        title: 'Prestaciones Asociadas',
      }),
      muchosAUno('prestacionAsociada', 'Prestación', 'prestacionesDentales', 'FK_prestacion'),
      seleccion('zona', 'Zona', OPCIONES_ZONA),
      entero('precio', 'Precio (CLP)'),
      seleccion(
        'estado',
        'Estado',
        [
          { value: 'planificado', label: 'Planificado', color: 'blue' },
          { value: 'realizado', label: 'Realizado', color: 'green' },
        ],
        { defaultValue: 'planificado' },
      ),
      textoLargo('notas', 'Notas'),
    ],
  },
];

async function existe(nombre) {
  const data = await api('collections:list', { params: { filter: JSON.stringify({ name: nombre }), paginate: 'false' } });
  return Array.isArray(data) && data.length > 0;
}

async function main() {
  TOKEN = await token();
  if (!(await existe('fichasClinicas'))) throw new Error('No existe la colección fichasClinicas en esta instancia.');

  for (const coleccion of COLECCIONES) {
    if (await existe(coleccion.name)) {
      console.log(`= ${coleccion.name}: ya existe, se omite`);
      continue;
    }
    const { fields, ...opciones } = coleccion;
    await api('collections:create', {
      values: {
        ...opciones,
        template: 'general',
        logging: true,
        autoGenId: false,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
        view: false,
        fields: [...camposSistema(), ...fields],
      },
    });
    console.log(`+ ${coleccion.name}: creada`);
  }

  // Título visible en selectores y asociaciones.
  await api('collections:update', { params: { filterByTk: 'prestacionesDentales' }, values: { titleField: 'nombrePrestacion' } });

  console.log('\nListo. Falta a mano: añadir la opción «Odontología» al campo tipoFicha de fichasClinicas.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
