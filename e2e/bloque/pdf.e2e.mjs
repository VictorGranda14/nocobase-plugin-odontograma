import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import { IMAGENES_MEMBRETE, api } from '../apoyo.mjs';
import { abrirFicha, agregarEnDiente, crearFicha, crearLinea, crearPlan, ctx, prestacion, registrarHooks } from './apoyo.mjs';

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

test('el PDF muestra las caras de una línea en la tabla', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000, { caras: 'Mesial,Oclusal' });

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    popup.getByRole('button', { name: /Descargar presupuesto/ }).click(),
  ]);
  const contenido = (await fs.readFile(await descarga.path())).toString('latin1');
  expect(contenido).toContain('(Diente 16 · Mesial · Oclusal)');
});

test('el PDF incluye un odontograma por cada dentición con prestaciones', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000);

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  const descargarPdf = async () => {
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      popup.getByRole('button', { name: /Descargar presupuesto/ }).click(),
    ]);
    return (await fs.readFile(await descarga.path())).toString('latin1');
  };
  const imagenesDe = (contenido) => contenido.match(/\/Subtype\s*\/Image/g)?.length ?? 0;

  expect(imagenesDe(await descargarPdf())).toBe(IMAGENES_MEMBRETE + 1); // solo permanentes

  await popup.getByRole('tab', { name: 'Temporal' }).click();
  await agregarEnDiente(page, popup, '5.4', 'Resina');
  await expect(popup.locator('.ant-table-row')).toHaveCount(2);

  const conAmbas = await descargarPdf();
  expect(imagenesDe(conAmbas)).toBe(IMAGENES_MEMBRETE + 2); // permanentes y temporales

  // La tabla empieza en la segunda hoja y esa hoja también lleva el membrete.
  const hojas = conAmbas.match(/\/Type\s*\/Page\b/g).length;
  expect(hojas).toBe(2);
  expect(conAmbas.match(/\/I\d+ Do/g).length).toBe(IMAGENES_MEMBRETE * hojas + 2);
});
