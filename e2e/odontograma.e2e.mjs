import { expect, test } from '@playwright/test';

const USUARIO = process.env.E2E_USER || 'admin@nocobase.com';
const CLAVE = process.env.E2E_PASSWORD || 'admin123';

let token;
let fichaId;

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

test.beforeEach(async ({ request, page }) => {
  const sesion = await request.post('/api/auth:signIn', {
    data: { account: USUARIO, password: CLAVE },
    headers: { 'X-Authenticator': 'basic' },
  });
  token = (await sesion.json()).data.token;
  const [fichaClinica] = await api(request, 'fichasClinicas:list', { params: { pageSize: 1 } });
  fichaId = (await api(request, 'fichaDental:create', { values: { fecha: '2026-10-31', FK_fichaClinica: fichaClinica.id } })).id;

  await page.goto('/signin');
  await page.getByPlaceholder(/usuario|correo|email/i).first().fill(USUARIO);
  await page.getByPlaceholder(/contraseña|password/i).fill(CLAVE);
  await page.getByRole('button', { name: /iniciar|sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin/);
});

// Borra solo lo creado por la prueba, por id: destroy con `filter` en la query no filtra y borraría todo.
test.afterEach(async ({ request }) => {
  const lineas = await api(request, 'prestacionesFichaDental:list', {
    params: { filter: JSON.stringify({ FK_fichaDental: fichaId }), paginate: 'false' },
  });
  for (const linea of lineas) {
    await api(request, 'prestacionesFichaDental:destroy', { params: { filterByTk: linea.id }, values: {} });
  }
  await api(request, 'fichaDental:destroy', { params: { filterByTk: fichaId }, values: {} });
});

// La ficha recién creada es la última fila de la tabla de la página «Fichas dentales».
const abrirFicha = async (page) => {
  await Promise.all([
    page.waitForResponse((respuesta) => respuesta.url().includes('fichaDental:list')),
    page.getByRole('menuitem', { name: 'Fichas dentales' }).click(),
  ]);
  await page.waitForLoadState('networkidle');
  await page.locator('.ant-table-row').last().getByText('Ver', { exact: true }).click();
  // El bloque es la tarjeta que contiene el odontograma (el popup puede abrirse como drawer o como subpágina).
  const bloque = page.locator('.ant-card').filter({ has: page.getByRole('group', { name: 'Arcada superior' }) });
  await expect(bloque).toBeVisible();
  return bloque;
};

const colorDe = (popup, numero) =>
  popup.getByRole('button', { name: `Pieza ${numero}`, exact: true }).locator('path').first().getAttribute('fill');

test('agregar una prestación al diente seleccionado la registra en esa pieza y la pinta con su color', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const popup = await abrirFicha(page);

  await popup.getByRole('button', { name: 'Pieza 2.6', exact: true }).click();
  await popup.locator('.ant-select').first().click();
  await page.keyboard.type('Resina');
  await page.keyboard.press('Enter');
  await popup.getByRole('button', { name: /Agregar/ }).click();

  await expect.poll(() => colorDe(popup, '2.6')).toBe(resina.color);
  const lineas = await api(request, 'prestacionesFichaDental:list', {
    params: { filter: JSON.stringify({ FK_fichaDental: fichaId }), paginate: 'false' },
  });
  expect(lineas.map((l) => [l.zona, l.FK_prestacion])).toEqual([['26', resina.id]]);
});

test('una ficha con prestaciones previas se pinta según la zona más específica y conserva tooltip, tabla y totales', async ({ page, request }) => {
  const [resina, destartraje, frenillos, limpieza] = await Promise.all(
    ['Resina', 'Destartraje por cuadrante', 'Frenillos arcada', 'Limpieza'].map((nombre) => prestacion(request, nombre)),
  );
  for (const [zona, p, precio] of [['16', resina, 35000], ['C1', destartraje, 25000], ['AS', frenillos, 450000], ['BOCA', limpieza, 30000]]) {
    await api(request, 'prestacionesFichaDental:create', {
      values: { FK_fichaDental: fichaId, FK_prestacion: p.id, zona, precio, estado: 'planificado' },
    });
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
