import { expect, test } from '@playwright/test';
import { api } from '../apoyo.mjs';
import { abrirFicha, crearFicha, crearLinea, crearPlan, prestacion, registrarHooks } from './apoyo.mjs';

// Estados de una prestación: planificado y realizado.

registrarHooks();

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
