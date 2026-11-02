import { expect, test } from '@playwright/test';
import { api } from '../apoyo.mjs';
import { abrirFicha, agregarEnDiente, colorDe, crearFicha, crearLinea, crearPlan, ctx, prestacion, registrarHooks } from './apoyo.mjs';

// Planes de tratamiento y atenciones: crear un plan nuevo y continuar el de una atención anterior.

registrarHooks();

test('una ficha sin plan permite crear un plan nuevo del paciente y trabajar sobre él', async ({ page, request }) => {
  const ficha = await crearFicha(request);
  const popup = await abrirFicha(page);

  await popup.getByRole('button', { name: 'Crear plan nuevo' }).click();
  await expect(popup.getByRole('group', { name: 'Arcada superior' })).toBeVisible();

  const { FK_planTratamiento: plan } = await api(request, 'fichaDental:get', { params: { filterByTk: ficha } });
  expect(plan).toBeTruthy();
  ctx.creados.planes.push(plan);
  expect((await api(request, 'planesTratamiento:get', { params: { filterByTk: plan } })).FK_paciente).toBe(ctx.pacienteId);
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
