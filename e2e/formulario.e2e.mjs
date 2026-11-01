import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

// Odontograma como campo del subformulario de la ficha dental, dentro del formulario de la ficha clínica:
// nada se graba hasta pulsar «Enviar», y entonces se graba todo junto.

const USUARIO = process.env.E2E_USER || 'admin@nocobase.com';
const CLAVE = process.env.E2E_PASSWORD || 'admin123';
const PAGINA = 'Fichas clínicas (E2E)';

let token;
let pacienteId;
let rutPaciente;
let ultimos; // ids más altos antes de la prueba, para saber qué creó y borrarlo
let fichasClinicasExtra; // ids creados por API en la preparación

const api = async (request, accion, { params, values } = {}) => {
  const respuesta = await request.fetch(`/api/${accion}`, {
    method: values ? 'POST' : 'GET',
    params,
    data: values,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(respuesta.ok(), `${accion}: ${respuesta.status()}`).toBeTruthy();
  return (await respuesta.json()).data;
};

const listar = (request, coleccion, filtro = {}) =>
  api(request, `${coleccion}:list`, { params: { filter: JSON.stringify(filtro), paginate: 'false', sort: 'id' } });

const ultimoId = async (request, coleccion) =>
  (await api(request, `${coleccion}:list`, { params: { sort: '-id', pageSize: 1 } }))[0]?.id ?? 0;

const prestacion = async (request, nombre) => (await listar(request, 'prestacionesDentales', { nombrePrestacion: nombre }))[0];

const nuevas = async (request, coleccion) => listar(request, coleccion, { id: { $gt: ultimos[coleccion] } });

test.beforeEach(async ({ request, page }) => {
  const sesion = await request.post('/api/auth:signIn', {
    data: { account: USUARIO, password: CLAVE },
    headers: { 'X-Authenticator': 'basic' },
  });
  token = (await sesion.json()).data.token;
  const [paciente] = await api(request, 'paciente:list', { params: { pageSize: 1, sort: 'id' } });
  pacienteId = paciente.id;
  rutPaciente = paciente.rutPaciente;
  ultimos = {};
  for (const coleccion of ['fichasClinicas', 'fichaDental', 'planesTratamiento', 'prestacionesPlanTratamiento']) {
    ultimos[coleccion] = await ultimoId(request, coleccion);
  }
  fichasClinicasExtra = [];

  await page.goto('/signin');
  await page.getByPlaceholder(/usuario|correo|email/i).first().fill(USUARIO);
  await page.getByPlaceholder(/contraseña|password/i).fill(CLAVE);
  await page.getByRole('button', { name: /iniciar|sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin/);
});

// Borra por id todo lo creado durante la prueba: destroy con `filter` en la query no filtra y borraría todo.
test.afterEach(async ({ request }) => {
  for (const coleccion of ['prestacionesPlanTratamiento', 'fichaDental', 'planesTratamiento', 'fichasClinicas']) {
    for (const registro of await nuevas(request, coleccion)) {
      await api(request, `${coleccion}:destroy`, { params: { filterByTk: registro.id }, values: {} });
    }
  }
});

const abrirPagina = async (page) => {
  await Promise.all([
    page.waitForResponse((respuesta) => respuesta.url().includes('fichasClinicas:list')),
    page.getByRole('menuitem', { name: PAGINA }).click(),
  ]);
  await page.waitForLoadState('networkidle');
};

const formItem = (contenedor, etiqueta) => contenedor.locator('.ant-formily-item').filter({ hasText: etiqueta }).first();

const elegirOpcion = async (page, contenedor, etiqueta, opcion) => {
  await formItem(contenedor, etiqueta).locator('.ant-select').first().click();
  await page.locator('.ant-select-dropdown:visible').getByText(opcion, { exact: true }).click();
};

// Abre «Añadir nuevo» y completa la ficha clínica de Odontología y la fecha de la ficha dental.
const nuevaFichaClinica = async (page, fecha = '2026-11-01') => {
  await abrirPagina(page);
  await page.getByRole('button', { name: /Añadir nuevo|Add new/ }).click();
  const drawer = page.locator('.ant-drawer-content').last();
  await expect(drawer).toBeVisible();
  await elegirOpcion(page, drawer, 'tipoFicha', 'Odontología');
  await elegirOpcion(page, drawer, 'Paciente Asociado', rutPaciente);
  const inputFecha = formItem(drawer, 'Fecha').locator('input').first();
  await inputFecha.click();
  await inputFecha.fill(fecha.split('-').reverse().join('/'));
  // Enter enviaría el formulario: se confirma el día en el calendario.
  await page.locator(`.ant-picker-dropdown:visible td[title="${fecha}"]`).click();
  return drawer;
};

// Los drawers de NocoBase se cierran haciendo clic fuera de ellos; puede pedir confirmar que se descartan los cambios.
const cerrarSinGuardar = async (page, drawer) => {
  await page.locator('.ant-drawer-mask').last().click({ position: { x: 20, y: 20 } });
  const confirmar = page.locator('.ant-modal-confirm .ant-btn-primary');
  if (await confirmar.isVisible({ timeout: 2000 }).catch(() => false)) await confirmar.click();
  await expect(drawer).toBeHidden();
};

const agregarEnDiente = async (page, plan, numero, nombre) => {
  await plan.getByRole('button', { name: `Pieza ${numero}`, exact: true }).click();
  await plan.locator('.ant-select').first().click();
  await page.keyboard.type(nombre);
  await page.keyboard.press('Enter');
  await plan.getByRole('button', { name: /Agregar/ }).click();
};

const enviar = async (page, drawer) => {
  await Promise.all([
    page.waitForResponse((r) => /fichasClinicas:(create|update)/.test(r.url()) && r.request().method() === 'POST'),
    drawer.getByRole('button', { name: /Enviar|Submit/ }).click(),
  ]);
};

test('crear una ficha clínica con plan nuevo guarda ficha, ficha dental, plan y prestaciones juntos, y la realizada queda en esa atención', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const drawer = await nuevaFichaClinica(page);

  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  const plan = drawer.locator('[data-odontograma]');
  await agregarEnDiente(page, plan, '1.6', 'Resina');
  await agregarEnDiente(page, plan, '2.6', 'Resina');
  await expect(plan.locator('.ant-table-row')).toHaveCount(2);
  await plan.locator('.ant-table-row').first().getByText('Planificado', { exact: true }).click();

  // Antes de enviar no hay nada grabado.
  expect(await nuevas(request, 'planesTratamiento')).toHaveLength(0);
  await enviar(page, drawer);

  const [fichaClinica] = await nuevas(request, 'fichasClinicas');
  expect(fichaClinica).toMatchObject({ tipoFicha: 'Odontología', FK_paciente: pacienteId });
  const fichas = await listar(request, 'fichaDental', { FK_fichaClinica: fichaClinica.id });
  expect(fichas).toHaveLength(1);
  const [ficha] = fichas;
  expect(ficha.fecha).toBe('2026-11-01');
  expect((await api(request, 'planesTratamiento:get', { params: { filterByTk: ficha.FK_planTratamiento } })).FK_paciente).toBe(pacienteId);
  const lineas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: ficha.FK_planTratamiento });
  expect(lineas.map((l) => [l.zona, l.FK_prestacion, l.estado, l.FK_fichaDentalRealizacion])).toEqual([
    ['16', resina.id, 'realizado', ficha.id],
    ['26', resina.id, 'planificado', null],
  ]);
});

test('crear una ficha clínica continuando un plan del paciente muestra lo anterior y agrega al mismo plan', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await api(request, 'planesTratamiento:create', { values: { FK_paciente: pacienteId } });
  await api(request, 'prestacionesPlanTratamiento:create', {
    values: { FK_planTratamiento: plan.id, FK_prestacion: resina.id, zona: '16', precio: 35000, estado: 'planificado' },
  });
  const drawer = await nuevaFichaClinica(page);

  await drawer.getByRole('combobox').last().click();
  await page.locator('.ant-select-dropdown:visible').getByText(/1 prestación$/).first().click();
  await drawer.getByRole('button', { name: 'Continuar plan' }).click();
  const vista = drawer.locator('[data-odontograma]');
  await expect(vista.locator('.ant-table-row')).toHaveCount(1);
  await agregarEnDiente(page, vista, '2.6', 'Resina');
  await expect(vista.locator('.ant-table-row')).toHaveCount(2);
  await enviar(page, drawer);

  const [fichaClinica] = await nuevas(request, 'fichasClinicas');
  const [ficha] = await listar(request, 'fichaDental', { FK_fichaClinica: fichaClinica.id });
  expect(ficha.FK_planTratamiento).toBe(plan.id);
  expect((await nuevas(request, 'planesTratamiento')).map((p) => p.id)).toEqual([plan.id]);
  const lineas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: plan.id });
  expect(lineas.map((l) => l.zona)).toEqual(['16', '26']);
});

test('cerrar el formulario sin guardar no graba ficha, plan ni prestaciones', async ({ page, request }) => {
  const drawer = await nuevaFichaClinica(page);
  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  const vista = drawer.locator('[data-odontograma]');
  await agregarEnDiente(page, vista, '1.6', 'Resina');
  await expect(vista.locator('.ant-table-row')).toHaveCount(1);

  await cerrarSinGuardar(page, drawer);

  for (const coleccion of ['fichasClinicas', 'fichaDental', 'planesTratamiento', 'prestacionesPlanTratamiento']) {
    expect(await nuevas(request, coleccion), coleccion).toHaveLength(0);
  }
});

// Ficha clínica de Odontología guardada, con su ficha dental y un plan con 2 prestaciones planificadas (16 y 26).
const fichaClinicaConPlan = async (request) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await api(request, 'planesTratamiento:create', { values: { FK_paciente: pacienteId } });
  const lineas = [];
  for (const zona of ['16', '26']) {
    lineas.push(
      await api(request, 'prestacionesPlanTratamiento:create', {
        values: { FK_planTratamiento: plan.id, FK_prestacion: resina.id, zona, precio: 35000, estado: 'planificado' },
      }),
    );
  }
  const fichaClinica = await api(request, 'fichasClinicas:create', { values: { tipoFicha: 'Odontología', FK_paciente: pacienteId } });
  const ficha = await api(request, 'fichaDental:create', {
    values: { fecha: '2026-10-30', FK_fichaClinica: fichaClinica.id, FK_planTratamiento: plan.id },
  });
  return { fichaClinica, ficha, plan, lineas };
};

const editarFichaClinica = async (page, id) => {
  await abrirPagina(page);
  await page.locator(`.ant-table-row[data-row-key="${id}"]`).getByText('Editar', { exact: true }).click();
  const drawer = page.locator('.ant-drawer-content').last();
  const vista = drawer.locator('[data-odontograma]');
  await expect(vista.locator('.ant-table-row')).toHaveCount(2);
  return { drawer, vista };
};

const filaDeZona = (vista, etiqueta) => vista.locator('.ant-table-row').filter({ hasText: etiqueta });

test('editar una ficha clínica guarda las prestaciones agregadas, quitadas y realizadas al pulsar Enviar', async ({ page, request }) => {
  const { fichaClinica, ficha, plan, lineas } = await fichaClinicaConPlan(request);
  const { drawer, vista } = await editarFichaClinica(page, fichaClinica.id);

  await agregarEnDiente(page, vista, '3.6', 'Resina');
  await filaDeZona(vista, '26').getByRole('button', { name: 'Eliminar' }).click();
  await page.locator('.ant-popconfirm:visible').getByRole('button', { name: 'Eliminar' }).click();
  await filaDeZona(vista, '16').getByText('Planificado', { exact: true }).click();
  await expect(vista.locator('.ant-table-row')).toHaveCount(2);
  await enviar(page, drawer);

  const guardadas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: plan.id });
  expect(guardadas.map((l) => [l.zona, l.estado, l.FK_fichaDentalRealizacion])).toEqual([
    ['16', 'realizado', ficha.id],
    ['36', 'planificado', null],
  ]);
  expect(await listar(request, 'prestacionesPlanTratamiento', { id: lineas[1].id })).toHaveLength(0);
});

test('cancelar la edición de una ficha clínica deja el plan como estaba', async ({ page, request }) => {
  const { fichaClinica, plan } = await fichaClinicaConPlan(request);
  const { drawer, vista } = await editarFichaClinica(page, fichaClinica.id);

  await agregarEnDiente(page, vista, '3.6', 'Resina');
  await filaDeZona(vista, '26').getByRole('button', { name: 'Eliminar' }).click();
  await page.locator('.ant-popconfirm:visible').getByRole('button', { name: 'Eliminar' }).click();
  await expect(vista.locator('.ant-table-row')).toHaveCount(2);
  await cerrarSinGuardar(page, drawer);

  const lineas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: plan.id });
  expect(lineas.map((l) => [l.zona, l.estado])).toEqual([
    ['16', 'planificado'],
    ['26', 'planificado'],
  ]);
});

test('descargar el presupuesto desde el formulario genera el PDF del paciente con la fecha y las observaciones de la atención', async ({ page }) => {
  const drawer = await nuevaFichaClinica(page, '2026-10-15');
  await formItem(drawer, 'Observaciones').locator('textarea').fill('Control en 6 meses');
  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  const vista = drawer.locator('[data-odontograma]');
  await agregarEnDiente(page, vista, '1.6', 'Resina');

  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    vista.getByRole('button', { name: /Descargar presupuesto/ }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(`presupuesto-${rutPaciente.replaceAll('.', '')}-`);
  // jsPDF no comprime el texto: se puede buscar en el archivo.
  const contenido = (await fs.readFile(await descarga.path())).toString('latin1');
  expect(contenido).toContain('15-10-2026');
  expect(contenido).toContain('Control en 6 meses');
  await cerrarSinGuardar(page, drawer);
});
