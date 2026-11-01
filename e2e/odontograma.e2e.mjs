import { expect, test } from '@playwright/test';

const USUARIO = process.env.E2E_USER || 'admin@nocobase.com';
const CLAVE = process.env.E2E_PASSWORD || 'admin123';

let token;
let pacienteId;
let fichaClinicaId;
let creados;

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

const prestacion = async (request, nombre) =>
  (await api(request, 'prestacionesDentales:list', { params: { filter: JSON.stringify({ nombrePrestacion: nombre }) } }))[0];

const crearPlan = async (request) => {
  const plan = await api(request, 'planesTratamiento:create', { values: { FK_paciente: pacienteId } });
  creados.planes.push(plan.id);
  return plan.id;
};

const crearFicha = async (request, { fecha = '2026-10-31', plan = null } = {}) => {
  const ficha = await api(request, 'fichaDental:create', {
    values: { fecha, FK_fichaClinica: fichaClinicaId, FK_planTratamiento: plan },
  });
  creados.fichas.push(ficha.id);
  return ficha.id;
};

const crearLinea = (request, plan, p, zona, precio, extra = {}) =>
  api(request, 'prestacionesPlanTratamiento:create', {
    values: { FK_planTratamiento: plan, FK_prestacion: p.id, zona, precio, estado: 'planificado', ...extra },
  });

const lineasDe = (request, plan) =>
  api(request, 'prestacionesPlanTratamiento:list', {
    params: { filter: JSON.stringify({ FK_planTratamiento: plan }), paginate: 'false', sort: 'id' },
  });

test.beforeEach(async ({ request, page }) => {
  const sesion = await request.post('/api/auth:signIn', {
    data: { account: USUARIO, password: CLAVE },
    headers: { 'X-Authenticator': 'basic' },
  });
  token = (await sesion.json()).data.token;
  creados = { planes: [], fichas: [] };
  const [fichaClinica] = await api(request, 'fichasClinicas:list', { params: { pageSize: 1 } });
  fichaClinicaId = fichaClinica.id;
  pacienteId = fichaClinica.FK_paciente;

  await page.goto('/signin');
  await page.getByPlaceholder(/usuario|correo|email/i).first().fill(USUARIO);
  await page.getByPlaceholder(/contraseña|password/i).fill(CLAVE);
  await page.getByRole('button', { name: /iniciar|sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin/);
});

// Borra solo lo creado por la prueba, por id: destroy con `filter` en la query no filtra y borraría todo.
test.afterEach(async ({ request }) => {
  for (const plan of creados.planes) {
    for (const linea of await lineasDe(request, plan)) {
      await api(request, 'prestacionesPlanTratamiento:destroy', { params: { filterByTk: linea.id }, values: {} });
    }
  }
  for (const ficha of creados.fichas) {
    await api(request, 'fichaDental:destroy', { params: { filterByTk: ficha }, values: {} });
  }
  for (const plan of creados.planes) {
    await api(request, 'planesTratamiento:destroy', { params: { filterByTk: plan }, values: {} });
  }
});

// La primera tabla de la página «Fichas dentales» es la de fichas dentales, por orden de creación:
// `desdeElFinal` 0 es la última creada.
const abrirFicha = async (page, desdeElFinal = 0) => {
  await Promise.all([
    page.waitForResponse((respuesta) => respuesta.url().includes('fichaDental:list')),
    page.getByRole('menuitem', { name: 'Fichas dentales' }).click(),
  ]);
  await page.waitForLoadState('networkidle');
  const filas = page.locator('.ant-table').first().locator('.ant-table-row');
  await filas.nth((await filas.count()) - 1 - desdeElFinal).getByText('Ver', { exact: true }).click();
  // El bloque es la tarjeta del odontograma (el popup puede abrirse como drawer o como subpágina).
  const bloque = page.locator('.ant-card').filter({ has: page.locator('[data-odontograma]') });
  await expect(bloque).toBeVisible();
  return bloque;
};

const colorDe = (popup, numero) =>
  popup.getByRole('button', { name: `Pieza ${numero}`, exact: true }).locator('path').first().getAttribute('fill');

const agregarEnDiente = async (page, popup, numero, nombre) => {
  await popup.getByRole('button', { name: `Pieza ${numero}`, exact: true }).click();
  await popup.locator('.ant-select').first().click();
  await page.keyboard.type(nombre);
  await page.keyboard.press('Enter');
  await popup.getByRole('button', { name: /Agregar/ }).click();
};

test('agregar una prestación al diente seleccionado la registra en esa pieza y la pinta con su color', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await agregarEnDiente(page, popup, '2.6', 'Resina');

  await expect.poll(() => colorDe(popup, '2.6')).toBe(resina.color);
  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.zona, l.FK_prestacion])).toEqual([['26', resina.id]]);
});

test('una ficha con prestaciones previas se pinta según la zona más específica y conserva tooltip, tabla y totales', async ({ page, request }) => {
  const [resina, destartraje, frenillos, limpieza] = await Promise.all(
    ['Resina', 'Destartraje por cuadrante', 'Frenillos arcada', 'Limpieza'].map((nombre) => prestacion(request, nombre)),
  );
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  for (const [zona, p, precio] of [['16', resina, 35000], ['C1', destartraje, 25000], ['AS', frenillos, 450000], ['BOCA', limpieza, 30000]]) {
    await crearLinea(request, plan, p, zona, precio);
  }

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(4); // espera a que carguen las líneas

  expect(await colorDe(popup, '1.6')).toBe(resina.color); // diente
  expect(await colorDe(popup, '1.5')).toBe(destartraje.color); // cuadrante 1 gana sobre la arcada
  expect(await colorDe(popup, '2.5')).toBe(frenillos.color); // solo arcada superior
  expect([resina.color, destartraje.color, frenillos.color, limpieza.color]).not.toContain(await colorDe(popup, '3.5'));
  await expect(popup.getByText('Limpieza').first()).toBeVisible(); // boca completa

  await popup.getByRole('button', { name: 'Pieza 1.6', exact: true }).hover();
  const tooltip = page.getByRole('tooltip');
  for (const nombre of ['Resina', 'Destartraje por cuadrante', 'Frenillos arcada', 'Limpieza']) {
    await expect(tooltip).toContainText(nombre);
  }

  await expect(popup.locator('.ant-statistic', { hasText: 'Total' })).toContainText('$540.000');
});

test('una ficha sin plan permite crear un plan nuevo del paciente y trabajar sobre él', async ({ page, request }) => {
  const ficha = await crearFicha(request);
  const popup = await abrirFicha(page);

  await popup.getByRole('button', { name: 'Crear plan nuevo' }).click();
  await expect(popup.getByRole('group', { name: 'Arcada superior' })).toBeVisible();

  const { FK_planTratamiento: plan } = await api(request, 'fichaDental:get', { params: { filterByTk: ficha } });
  expect(plan).toBeTruthy();
  creados.planes.push(plan);
  expect((await api(request, 'planesTratamiento:get', { params: { filterByTk: plan } })).FK_paciente).toBe(pacienteId);
});

test('continuar el plan de una atención anterior muestra sus prestaciones y lo agregado se ve en ambas atenciones', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { fecha: '2026-10-20', plan });
  await crearLinea(request, plan, resina, '16', 35000);
  const fichaNueva = await crearFicha(request);

  let popup = await abrirFicha(page);
  await popup.getByRole('combobox').click();
  await page.getByRole('option', { name: /1 prestación/ }).click();
  await popup.getByRole('button', { name: 'Continuar plan' }).click();

  await expect.poll(() => colorDe(popup, '1.6')).toBe(resina.color);
  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  expect((await api(request, 'fichaDental:get', { params: { filterByTk: fichaNueva } })).FK_planTratamiento).toBe(plan);

  await agregarEnDiente(page, popup, '2.6', 'Resina');
  await expect(popup.locator('.ant-table-row')).toHaveCount(2);

  popup = await abrirFicha(page, 1);
  await expect(popup.locator('.ant-table-row')).toHaveCount(2);
  await expect.poll(() => colorDe(popup, '2.6')).toBe(resina.color);
});

test('marcar realizada una prestación registra la atención y la tabla muestra su fecha; volver a planificado lo limpia', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  const ficha = await crearFicha(request, { fecha: '2026-10-30', plan });
  const linea = await crearLinea(request, plan, resina, '16', 35000);

  const popup = await abrirFicha(page);
  const fila = popup.locator('.ant-table-row').first();
  await fila.getByText('Planificado', { exact: true }).click();

  await expect(fila).toContainText('Realizado el 30-10-2026');
  expect((await api(request, 'prestacionesPlanTratamiento:get', { params: { filterByTk: linea.id } })).FK_fichaDentalRealizacion).toBe(ficha);

  await fila.getByText('Realizado', { exact: true }).click();
  await expect(fila).toContainText('Planificado');
  await expect(fila).not.toContainText('30-10-2026');
  expect((await api(request, 'prestacionesPlanTratamiento:get', { params: { filterByTk: linea.id } })).FK_fichaDentalRealizacion).toBeNull();
});

test('descargar el presupuesto desde el bloque genera el PDF con el RUT del paciente', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000);
  const { rutPaciente } = await api(request, 'paciente:get', { params: { filterByTk: pacienteId } });

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    popup.getByRole('button', { name: /Descargar presupuesto/ }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(`presupuesto-${rutPaciente.replaceAll('.', '')}-`);
  expect(descarga.suggestedFilename().endsWith('.pdf')).toBe(true);
});

test('el bloque muestra las secciones en orden de creación con su subtotal y agrega a la sección indicada', async ({ page, request }) => {
  const [resina, frenillos] = await Promise.all(['Resina', 'Frenillos arcada'].map((nombre) => prestacion(request, nombre)));
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, frenillos, 'AS', 450000, { seccion: 'Ortodoncia' });
  await crearLinea(request, plan, resina, '16', 35000, { seccion: 'Urgencia' });
  await crearLinea(request, plan, resina, '26', 35000, { seccion: 'Urgencia' });

  const popup = await abrirFicha(page);
  const nombres = () => popup.locator('[data-seccion]').evaluateAll((nodos) => nodos.map((n) => n.getAttribute('data-seccion')));
  await expect.poll(nombres).toEqual(['Ortodoncia', 'Urgencia']);
  await expect(popup.locator('[data-seccion="Urgencia"] [data-subtotal]')).toHaveText('$70.000');

  await popup.getByPlaceholder('Sección (opcional)').fill('Urgencia');
  await agregarEnDiente(page, popup, '3.6', 'Resina');
  await expect(popup.locator('[data-seccion="Urgencia"] .ant-table-row')).toHaveCount(3);
  const lineas = await lineasDe(request, plan);
  expect(lineas.find((l) => l.zona === '36').seccion).toBe('Urgencia');
});

test('renombrar y eliminar una sección desde el bloque lo aplica al instante a sus prestaciones', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000, { seccion: 'Etapa 1' });
  await crearLinea(request, plan, resina, '26', 35000, { seccion: 'Etapa 1' });
  const otra = await crearLinea(request, plan, resina, '36', 35000, { seccion: 'Etapa 2' });

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(3);
  const menu = async (nombre, opcion) => {
    await popup.getByRole('button', { name: `Opciones de la sección ${nombre}` }).click();
    await page.locator('.ant-dropdown:visible').getByText(opcion, { exact: true }).click();
  };

  await menu('Etapa 2', 'Renombrar');
  await page.locator('.ant-modal:visible').getByRole('textbox').fill('Ortodoncia');
  await page.locator('.ant-modal:visible').getByRole('button', { name: 'Renombrar' }).click();
  await expect(popup.locator('[data-seccion="Ortodoncia"]')).toBeVisible();

  await menu('Etapa 1', 'Eliminar');
  const confirmacion = page.locator('.ant-modal-confirm:visible');
  await expect(confirmacion).toContainText('Se eliminarán 2 prestaciones');
  await confirmacion.getByRole('button', { name: 'Eliminar' }).click();
  await expect(popup.locator('.ant-table-row')).toHaveCount(1);

  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.id, l.seccion])).toEqual([[otra.id, 'Ortodoncia']]);
});
