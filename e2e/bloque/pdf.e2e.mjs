import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import { api } from '../apoyo.mjs';
import { abrirFicha, crearFicha, crearLinea, crearPlan, ctx, prestacion, registrarHooks } from './apoyo.mjs';

// Presupuesto en PDF descargado desde el bloque.

registrarHooks();

test('descargar el presupuesto desde el bloque genera el PDF del paciente; sin secciones, ordenado por zona y sin subtotales', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '26', 35000);
  await crearLinea(request, plan, resina, '16', 35000);
  const { rutPaciente } = await api(request, 'paciente:get', { params: { filterByTk: ctx.pacienteId } });

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(2);
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    popup.getByRole('button', { name: /Descargar presupuesto/ }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(`presupuesto-${rutPaciente.replaceAll('.', '')}-`);
  expect(descarga.suggestedFilename().endsWith('.pdf')).toBe(true);
  const contenido = (await fs.readFile(await descarga.path())).toString('latin1');
  expect(contenido.indexOf('(Diente 16)')).toBeGreaterThan(-1);
  expect(contenido.indexOf('(Diente 26)')).toBeGreaterThan(contenido.indexOf('(Diente 16)'));
  expect(contenido).not.toContain('(Subtotal');
});
