import { expect, test } from '@playwright/test';
import { abrirFicha, agregarEnDiente, colorDe, crearFicha, crearLinea, crearPlan, lineasDe, prestacion, registrarHooks } from './apoyo.mjs';

// Dibujo y pintado del odontograma en el bloque.

registrarHooks();

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

test('una ficha con prestaciones previas pinta cada diente con sus propias prestaciones y conserva tooltip, tabla y totales', async ({ page, request }) => {
  const [resina, destartraje, frenillos, limpieza] = await Promise.all(
    ['Resina', 'Destartraje por sextante', 'Frenillos arcada', 'Limpieza'].map((nombre) => prestacion(request, nombre)),
  );
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  for (const [zona, p, precio] of [['16', resina, 35000], ['S1', destartraje, 25000], ['AS', frenillos, 450000], ['BOCA', limpieza, 30000]]) {
    await crearLinea(request, plan, p, zona, precio);
  }

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(4); // espera a que carguen las líneas

  expect(await colorDe(popup, '1.6')).toBe(resina.color); // diente
  expect(await colorDe(popup, '1.5')).toBe('#fff'); // el sextante pinta su selector, no sus dientes
  expect(await colorDe(popup, '2.5')).toBe('#fff'); // la arcada pinta su selector, no sus dientes
  expect(await colorDe(popup, '3.5')).toBe('#fff');

  await popup.getByRole('button', { name: 'Pieza 1.6', exact: true }).hover();
  const tooltip = page.getByRole('tooltip');
  for (const nombre of ['Resina', 'Destartraje por sextante', 'Frenillos arcada', 'Limpieza']) {
    await expect(tooltip).toContainText(nombre);
  }

  await expect(popup.locator('.ant-statistic', { hasText: 'Total' })).toContainText('$540.000');
});
