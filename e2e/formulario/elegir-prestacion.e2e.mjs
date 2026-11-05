import { expect, test } from '@playwright/test';
import { enviar, nuevaFichaClinica, nuevas, prestacion, registrarHooks } from './apoyo.mjs';

// Selector de prestación en dos columnas dentro del formulario de la ficha clínica.

registrarHooks();

const alcances = (page) => page.locator('.ant-select-dropdown:visible [data-alcance]');
const prestaciones = (page) => page.locator('.ant-select-dropdown:visible [data-prestacion]');

const crearPlanNuevo = async (page) => {
  const drawer = await nuevaFichaClinica(page);
  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  return { drawer, plan: drawer.locator('[data-odontograma]') };
};

test('con el dibujo visible, una prestación elegida en las columnas se graba al pulsar Enviar', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const { drawer, plan } = await crearPlanNuevo(page);

  await plan.getByRole('button', { name: 'Pieza 1.6', exact: true }).click();
  await plan.locator('.ant-select').first().click();
  await prestaciones(page).filter({ hasText: 'Resina' }).click();
  await plan.getByRole('button', { name: /Agregar/ }).click();
  await expect(plan.locator('.ant-table-row')).toHaveCount(1);
  await enviar(page, drawer);

  const lineas = await nuevas(request, 'prestacionesPlanTratamiento');
  expect(lineas.map((l) => [l.zona, l.FK_prestacion])).toEqual([['16', resina.id]]);
});

test('con el dibujo oculto, una prestación elegida en las columnas se graba al pulsar Enviar, con la zona elegida en la lista', async ({ page, request }) => {
  const destartraje = await prestacion(request, 'Destartraje por sextante');
  const { drawer, plan } = await crearPlanNuevo(page);

  await plan.getByRole('switch', { name: 'Mostrar odontograma' }).click();
  await plan.locator('.ant-select').first().click();
  await alcances(page).filter({ hasText: 'Por sextante' }).click();
  await prestaciones(page).filter({ hasText: 'Destartraje por sextante' }).click();
  await plan.locator('[data-lista-zonas]').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Sextante 2' }).click();
  await plan.getByRole('button', { name: /Agregar/ }).click();
  await expect(plan.locator('.ant-table-row')).toHaveCount(1);
  await enviar(page, drawer);

  const lineas = await nuevas(request, 'prestacionesPlanTratamiento');
  expect(lineas.map((l) => [l.zona, l.FK_prestacion])).toEqual([['S2', destartraje.id]]);
});

test('el desplegable mide 520 px sin agrandar el campo', async ({ page }) => {
  const { plan } = await crearPlanNuevo(page);
  const selector = plan.locator('.ant-select').first();

  await selector.click();

  await expect(alcances(page)).not.toHaveCount(0);
  expect((await page.locator('.ant-select-dropdown:visible').boundingBox()).width).toBe(520);
  expect((await selector.boundingBox()).width).toBe(260);
});

test('el campo sigue midiendo 260 px con una prestación de nombre largo elegida', async ({ page }) => {
  const { plan } = await crearPlanNuevo(page);
  const selector = plan.locator('.ant-select').first();

  await selector.click();
  await alcances(page).filter({ hasText: 'Por sextante' }).click();
  await prestaciones(page).filter({ hasText: 'Destartraje por sextante' }).click();

  await expect(selector).toContainText('Destartraje por sextante · Por sextante');
  expect((await selector.boundingBox()).width).toBe(260);
});

test('el desplegable no se sale de la pantalla en una ventana angosta', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  const { plan } = await crearPlanNuevo(page);

  await plan.locator('.ant-select').first().click();

  await expect(alcances(page)).not.toHaveCount(0);
  const caja = await page.locator('.ant-select-dropdown:visible').boundingBox();
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(900);
});

test('Escape cierra solo el selector, sin cerrar el formulario', async ({ page }) => {
  const { drawer, plan } = await crearPlanNuevo(page);
  await plan.locator('.ant-select').first().click();
  await expect(alcances(page)).not.toHaveCount(0);

  await page.keyboard.press('Escape');

  await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0);
  await expect(page.getByText('Cambios no guardados')).toHaveCount(0);
  await expect(drawer).toBeVisible();
});
