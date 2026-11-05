import { expect, test } from '@playwright/test';
import { api, iniciarSesionApi, iniciarSesionUi } from '../apoyo.mjs';

// Apoyo de las pruebas del bloque Odontograma en el popup «Ver» de una ficha dental.

// Estado compartido: lo asigna el beforeEach registrado por registrarHooks y lo leen los helpers.
export const ctx = {
  pacienteId: undefined,
  fichaClinicaId: undefined,
  creados: undefined,
};

export const prestacion = async (request, nombre) =>
  (await api(request, 'prestacionesDentales:list', { params: { filter: JSON.stringify({ nombrePrestacion: nombre }) } }))[0];

export const crearPlan = async (request) => {
  const plan = await api(request, 'planesTratamiento:create', { values: { FK_paciente: ctx.pacienteId } });
  ctx.creados.planes.push(plan.id);
  return plan.id;
};

export const crearFicha = async (request, { fecha = '2026-10-31', plan = null } = {}) => {
  const ficha = await api(request, 'fichaDental:create', {
    values: { fecha, FK_fichaClinica: ctx.fichaClinicaId, FK_planTratamiento: plan },
  });
  ctx.creados.fichas.push(ficha.id);
  return ficha.id;
};

export const crearLinea = (request, plan, p, zona, precio, extra = {}) =>
  api(request, 'prestacionesPlanTratamiento:create', {
    values: { FK_planTratamiento: plan, FK_prestacion: p.id, zona, precio, estado: 'planificado', ...extra },
  });

export const lineasDe = (request, plan) =>
  api(request, 'prestacionesPlanTratamiento:list', {
    params: { filter: JSON.stringify({ FK_planTratamiento: plan }), paginate: 'false', sort: 'id' },
  });

// Registra el beforeEach (sesión y preparación) y el afterEach (limpieza) en el archivo de pruebas que lo llame.
export const registrarHooks = () => {
  test.beforeEach(async ({ request, page }) => {
    await iniciarSesionApi(request);
    ctx.creados = { planes: [], fichas: [] };
    const [fichaClinica] = await api(request, 'fichasClinicas:list', { params: { pageSize: 1 } });
    ctx.fichaClinicaId = fichaClinica.id;
    ctx.pacienteId = fichaClinica.FK_paciente;

    await iniciarSesionUi(page);
  });

  // Borra solo lo creado por la prueba, por id: destroy con `filter` en la query no filtra y borraría todo.
  test.afterEach(async ({ request }) => {
    for (const plan of ctx.creados.planes) {
      for (const linea of await lineasDe(request, plan)) {
        await api(request, 'prestacionesPlanTratamiento:destroy', { params: { filterByTk: linea.id }, values: {} });
      }
    }
    for (const ficha of ctx.creados.fichas) {
      await api(request, 'fichaDental:destroy', { params: { filterByTk: ficha }, values: {} });
    }
    for (const plan of ctx.creados.planes) {
      await api(request, 'planesTratamiento:destroy', { params: { filterByTk: plan }, values: {} });
    }
  });
};

// La primera tabla de la página «Fichas dentales» es la de fichas dentales, por orden de creación:
// `desdeElFinal` 0 es la última creada.
export const abrirFicha = async (page, desdeElFinal = 0) => {
  await page.getByRole('menuitem', { name: 'Fichas dentales' }).click();
  await page.waitForURL(/\/admin\/[^/]+$/);
  // Si la tabla ya cargó al iniciar sesión, el clic no la vuelve a pedir y le faltarían las fichas de la prueba: se recarga.
  await Promise.all([
    page.waitForResponse((respuesta) => respuesta.url().includes('fichaDental:list')),
    page.reload(),
  ]);
  await page.waitForLoadState('networkidle');
  const filas = page.locator('.ant-table').first().locator('.ant-table-row');
  const ver = filas.nth((await filas.count()) - 1 - desdeElFinal).getByText('Ver', { exact: true });
  // El bloque es la tarjeta del odontograma (el popup puede abrirse como drawer o como subpágina).
  const bloque = page.locator('.ant-card').filter({ has: page.locator('[data-odontograma]') });
  // El clic se puede perder si la tabla se vuelve a dibujar en ese momento: se reintenta hasta que se abra.
  await expect(async () => {
    if (!(await bloque.isVisible())) await ver.click({ timeout: 2000 });
    await expect(bloque).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  return bloque;
};

export const colorDe = (popup, numero) =>
  popup.getByRole('button', { name: `Pieza ${numero}`, exact: true }).locator('path').first().getAttribute('fill');

export const agregarEnDiente = async (page, popup, numero, nombre) => {
  await popup.getByRole('button', { name: `Pieza ${numero}`, exact: true }).click();
  await popup.locator('.ant-select').first().click();
  await page.keyboard.type(nombre);
  await page.keyboard.press('Enter');
  await popup.getByRole('button', { name: /Agregar/ }).click();
};
