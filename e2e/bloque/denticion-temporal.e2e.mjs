import { expect, test } from '@playwright/test';
import { abrirFicha, agregarEnDiente, colorDe, crearFicha, crearLinea, crearPlan, lineasDe, prestacion, registrarHooks } from './apoyo.mjs';

// Dentición temporal (#5): pestañas Permanente/Temporal y prestaciones en dientes de leche.

registrarHooks();

test('el odontograma se abre en Permanente y la pestaña Temporal muestra los dientes de leche; se puede volver a Permanente', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);
  const pieza = (numero) => popup.getByRole('button', { name: `Pieza ${numero}`, exact: true });

  await expect(popup.getByRole('tab', { name: 'Permanente' })).toHaveAttribute('aria-selected', 'true');
  await expect(pieza('1.6')).toBeVisible();
  await expect(pieza('5.4')).toHaveCount(0);

  await popup.getByRole('tab', { name: 'Temporal' }).click();
  await expect(pieza('5.4')).toBeVisible();
  await expect(pieza('8.5')).toBeVisible();
  await expect(pieza('1.6')).toHaveCount(0);

  await popup.getByRole('tab', { name: 'Permanente' }).click();
  await expect(pieza('1.6')).toBeVisible();
  await expect(pieza('5.4')).toHaveCount(0);
});

test('agregar una prestación a un diente temporal la registra en esa pieza, lo pinta y la tabla muestra «Diente 54»', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await popup.getByRole('tab', { name: 'Temporal' }).click();
  await agregarEnDiente(page, popup, '5.4', 'Resina');

  await expect.poll(() => colorDe(popup, '5.4')).toBe(resina.color);
  await expect(popup.getByText('Diente 54 · Primer molar')).toBeVisible();
  await expect(popup.locator('.ant-table-row').first()).toContainText('Diente 54');
  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.zona, l.FK_prestacion])).toEqual([['54', resina.id]]);
});

test('el tooltip de un diente temporal lista sus prestaciones y las de arcada y boca completa que lo afectan', async ({ page, request }) => {
  const [resina, frenillos, limpieza] = await Promise.all(
    ['Resina', 'Frenillos arcada', 'Limpieza'].map((nombre) => prestacion(request, nombre)),
  );
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  for (const [zona, p, precio] of [['54', resina, 35000], ['AS', frenillos, 450000], ['BOCA', limpieza, 30000]]) {
    await crearLinea(request, plan, p, zona, precio);
  }

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(3); // espera a que carguen las líneas
  await popup.getByRole('tab', { name: 'Temporal' }).click();
  const tooltip = page.getByRole('tooltip');

  await popup.getByRole('button', { name: 'Pieza 5.4', exact: true }).hover();
  for (const nombre of ['Resina', 'Frenillos arcada', 'Limpieza']) {
    await expect(tooltip).toContainText(nombre);
  }

  // Un diente inferior: no lo afectan ni la resina del 54 ni la arcada superior.
  await popup.getByRole('button', { name: 'Pieza 8.4', exact: true }).hover();
  await expect(tooltip).toContainText('Limpieza');
  await expect(tooltip).not.toContainText('Resina');
  await expect(tooltip).not.toContainText('Frenillos arcada');
});
