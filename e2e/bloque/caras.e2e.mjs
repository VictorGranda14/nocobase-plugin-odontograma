import { expect, test } from '@playwright/test';
import { abrirFicha, colorDe, crearFicha, crearLinea, crearPlan, lineasDe, prestacion, registrarHooks } from './apoyo.mjs';

// Prestaciones por cara del diente (#2).

registrarHooks();

const pieza = (popup, numero) => popup.getByRole('button', { name: `Pieza ${numero}`, exact: true });
const cara = (popup, numero, nombre) => popup.getByRole('button', { name: `Caras de la pieza ${numero}`, exact: true }).getByLabel(nombre, { exact: true });
const colorDeCara = (popup, numero, nombre) => cara(popup, numero, nombre).getAttribute('fill');
const zonasDeLaTabla = (popup) => popup.locator('.ant-table-row td:first-child').allTextContents();

const agregar = async (page, popup, nombre) => {
  await popup.locator('.ant-select').first().click();
  await page.keyboard.type(nombre);
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: nombre }).click();
  await popup.getByRole('button', { name: /Agregar/ }).click();
};

test('marcar varias caras las muestra en el título, y al desmarcar una desaparece de él', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await cara(popup, '1.6', 'Mesial').click();
  await cara(popup, '1.6', 'Oclusal').click();
  await expect(popup.getByRole('heading', { name: 'Diente 16 · Primer molar · Mesial · Oclusal' })).toBeVisible();
  await expect(cara(popup, '1.6', 'Mesial')).toHaveAttribute('aria-pressed', 'true');
  await expect(cara(popup, '1.6', 'Distal')).toHaveAttribute('aria-pressed', 'false');

  await cara(popup, '1.6', 'Mesial').click();
  await expect(popup.getByRole('heading', { name: 'Diente 16 · Primer molar · Oclusal' })).toBeVisible();
  await expect(cara(popup, '1.6', 'Mesial')).toHaveAttribute('aria-pressed', 'false');
});

test('el clic en el perfil pasa al diente completo; otro diente o zona deja de mostrar las caras, y una cara de otro diente deja marcada solo esa', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await cara(popup, '1.6', 'Mesial').click();
  await pieza(popup, '1.6').click();
  await expect(popup.getByRole('heading', { name: 'Diente 16 · Primer molar', exact: true })).toBeVisible();
  await expect(cara(popup, '1.6', 'Mesial')).toHaveAttribute('aria-pressed', 'false');

  await cara(popup, '1.6', 'Mesial').click();
  await pieza(popup, '2.6').click();
  await expect(popup.getByRole('heading', { name: 'Diente 26 · Primer molar', exact: true })).toBeVisible();

  await cara(popup, '2.6', 'Distal').click();
  await popup.getByRole('button', { name: 'Arcada superior', exact: true }).click();
  await expect(popup.getByRole('heading', { name: 'Arcada superior' })).toBeVisible();

  await cara(popup, '2.6', 'Distal').click();
  await cara(popup, '1.6', 'Oclusal').click();
  await expect(popup.getByRole('heading', { name: 'Diente 16 · Primer molar · Oclusal' })).toBeVisible();
  await expect(cara(popup, '2.6', 'Distal')).toHaveAttribute('aria-pressed', 'false');
  await expect(cara(popup, '1.6', 'Oclusal')).toHaveAttribute('aria-pressed', 'true');
});

test('con caras marcadas, agregar una prestación de diente crea una sola línea con esas caras, y las caras siguen marcadas', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await cara(popup, '1.6', 'Mesial').click();
  await cara(popup, '1.6', 'Oclusal').click();
  await agregar(page, popup, 'Resina');

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  expect(await zonasDeLaTabla(popup)).toEqual(['Diente 16 · Mesial · Oclusal']);
  await expect(cara(popup, '1.6', 'Mesial')).toHaveAttribute('aria-pressed', 'true');
  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.zona, l.caras, l.FK_prestacion, Number(l.precio), l.estado])).toEqual([['16', 'Mesial,Oclusal', resina.id, Number(resina.precio), 'planificado']]);
});

test('sin caras marcadas, la prestación queda en el diente completo, sin caras', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await pieza(popup, '1.6').click();
  await agregar(page, popup, 'Resina');

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  expect(await zonasDeLaTabla(popup)).toEqual(['Diente 16']);
  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.zona, l.caras ?? null])).toEqual([['16', null]]);
});

test('una línea con caras se marca como realizada y se elimina como una sola fila', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000, { caras: 'Mesial,Oclusal' });
  const popup = await abrirFicha(page);
  const fila = popup.locator('.ant-table-row');
  await expect(fila).toHaveCount(1);

  await fila.getByText('Planificado', { exact: true }).click();
  await expect(fila.getByText('Realizado', { exact: true })).toBeVisible();
  const [realizada] = await lineasDe(request, plan);
  expect([realizada.estado, realizada.caras]).toEqual(['realizado', 'Mesial,Oclusal']);

  await fila.getByRole('button', { name: 'Eliminar' }).click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: 'Eliminar' }).click();
  await expect(fila).toHaveCount(0);
  expect(await lineasDe(request, plan)).toHaveLength(0);
});

test('las caras de un diente temporal se registran igual', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await popup.getByRole('tab', { name: 'Temporal' }).click();
  await cara(popup, '5.4', 'Palatino').click();
  await expect(popup.getByRole('heading', { name: 'Diente 54 · Primer molar · Palatino' })).toBeVisible();
  await agregar(page, popup, 'Resina');

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  expect(await zonasDeLaTabla(popup)).toEqual(['Diente 54 · Palatino']);
  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.zona, l.caras])).toEqual([['54', 'Palatino']]);
});

test('una prestación por cara pinta esas caras y el perfil, y deja las otras caras sin pintar', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000, { caras: 'Mesial,Oclusal' });
  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(1); // espera a que carguen las líneas

  expect(await colorDe(popup, '1.6')).toBe(resina.color);
  expect(await colorDeCara(popup, '1.6', 'Mesial')).toBe(resina.color);
  expect(await colorDeCara(popup, '1.6', 'Oclusal')).toBe(resina.color);
  expect(await colorDeCara(popup, '1.6', 'Distal')).toBe('#fff');
  expect(await colorDeCara(popup, '1.6', 'Vestibular')).toBe('#fff');
  expect(await colorDeCara(popup, '1.6', 'Palatino')).toBe('#fff');
});

test('las prestaciones se aplican en orden de creación: en cada parte del diente gana la última que la afecta', async ({ page, request }) => {
  const [resina, limpieza] = await Promise.all(['Resina', 'Limpieza'].map((nombre) => prestacion(request, nombre)));
  expect(resina.color).not.toBe(limpieza.color);
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  // 1.6: primero por cara y después el diente completo, que cubre todo.
  await crearLinea(request, plan, resina, '16', 35000, { caras: 'Mesial' });
  await crearLinea(request, plan, limpieza, '16', 30000);
  // 2.6: primero el diente completo y después por cara, que cambia esa cara y el perfil.
  await crearLinea(request, plan, limpieza, '26', 30000);
  await crearLinea(request, plan, resina, '26', 35000, { caras: 'Mesial' });
  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(4); // espera a que carguen las líneas

  expect(await colorDe(popup, '1.6')).toBe(limpieza.color);
  expect(await colorDeCara(popup, '1.6', 'Mesial')).toBe(limpieza.color);
  expect(await colorDeCara(popup, '1.6', 'Distal')).toBe(limpieza.color);

  expect(await colorDe(popup, '2.6')).toBe(resina.color);
  expect(await colorDeCara(popup, '2.6', 'Mesial')).toBe(resina.color);
  expect(await colorDeCara(popup, '2.6', 'Distal')).toBe(limpieza.color);
});

test('el tooltip del diente muestra la prestación con sus caras', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000, { caras: 'Mesial,Oclusal' });
  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(1); // espera a que carguen las líneas

  await pieza(popup, '1.6').hover();
  await expect(page.getByRole('tooltip')).toContainText('Resina · Mesial · Oclusal');
});

test('el interruptor de filtro sigue funcionando por diente e incluye sus líneas por cara', async ({ page, request }) => {
  const [resina, limpieza] = await Promise.all(['Resina', 'Limpieza'].map((nombre) => prestacion(request, nombre)));
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000, { caras: 'Distal' });
  await crearLinea(request, plan, resina, '26', 35000, { caras: 'Mesial' });
  await crearLinea(request, plan, limpieza, 'BOCA', 30000);
  const popup = await abrirFicha(page);
  const filas = popup.locator('.ant-table-row');
  await expect(filas).toHaveCount(3); // espera a que carguen las líneas

  // Con otra cara marcada del mismo diente, su línea por «Distal» sigue visible.
  await cara(popup, '1.6', 'Mesial').click();
  await popup.locator('[data-filtro]').click();
  await expect(filas).toHaveCount(2);
  expect((await zonasDeLaTabla(popup)).sort()).toEqual(['Boca completa', 'Diente 16 · Distal']);
});

test('un clic en el borde del círculo no borra las caras marcadas', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await cara(popup, '1.6', 'Mesial').click();
  const caja = await popup.getByRole('button', { name: 'Caras de la pieza 1.6', exact: true }).boundingBox();
  await page.mouse.click(caja.x + caja.width - 2, caja.y + caja.height / 2);

  await expect(cara(popup, '1.6', 'Mesial')).toHaveAttribute('aria-pressed', 'true');
  await expect(popup.getByRole('heading', { name: 'Diente 16 · Primer molar · Mesial' })).toBeVisible();
});

test('con caras marcadas, una prestación de boca queda en la boca, sin caras', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await cara(popup, '1.6', 'Mesial').click();
  await agregar(page, popup, 'Limpieza');

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  expect(await zonasDeLaTabla(popup)).toEqual(['Boca completa']);
  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.zona, l.caras ?? null])).toEqual([['BOCA', null]]);
});

test('el tooltip muestra «-» en una línea por cara cuya prestación ya no existe', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, { id: null }, '16', 35000, { caras: 'Mesial' });
  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(1); // espera a que carguen las líneas

  await pieza(popup, '1.6').hover();
  await expect(page.getByRole('tooltip')).toContainText('- · Mesial');
});
