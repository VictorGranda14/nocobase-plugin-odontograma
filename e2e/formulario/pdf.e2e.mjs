import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import { agregarEnDiente, cerrarSinGuardar, ctx, formItem, nuevaFichaClinica, registrarHooks } from './apoyo.mjs';

// Presupuesto en PDF descargado desde el formulario.

registrarHooks();

test('descargar el presupuesto desde el formulario genera el PDF del paciente con la fecha y las observaciones de la atención', async ({ page }) => {
  const drawer = await nuevaFichaClinica(page, '2026-10-15');
  await formItem(drawer, 'Observaciones').locator('textarea').fill('Control en 6 meses');
  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  const vista = drawer.locator('[data-odontograma]');
  await agregarEnDiente(page, vista, '1.6', 'Resina');

  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    vista.getByRole('button', { name: /Descargar presupuesto/ }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(`presupuesto-${ctx.rutPaciente.replaceAll('.', '')}-`);
  // jsPDF no comprime el texto: se puede buscar en el archivo.
  const contenido = (await fs.readFile(await descarga.path())).toString('latin1');
  expect(contenido).toContain('15-10-2026');
  expect(contenido).toContain('Control en 6 meses');
  await cerrarSinGuardar(page, drawer);
});

test('el PDF agrupa las prestaciones por sección con su título y subtotal, en el orden de la pantalla', async ({ page }) => {
  const drawer = await nuevaFichaClinica(page);
  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  const vista = drawer.locator('[data-odontograma]');
  const seccion = vista.getByPlaceholder('Sección (opcional)');
  await seccion.fill('Ortodoncia');
  await agregarEnDiente(page, vista, '3.6', 'Resina');
  await seccion.fill('Urgencia');
  await agregarEnDiente(page, vista, '1.6', 'Resina');
  await agregarEnDiente(page, vista, '2.6', 'Resina');

  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    vista.getByRole('button', { name: /Descargar presupuesto/ }).click(),
  ]);
  const contenido = (await fs.readFile(await descarga.path())).toString('latin1');
  const posicion = (texto) => contenido.indexOf(`(${texto})`);
  expect(posicion('Ortodoncia')).toBeGreaterThan(-1);
  expect(posicion('Urgencia')).toBeGreaterThan(posicion('Ortodoncia'));
  expect(posicion('Subtotal')).toBeGreaterThan(-1);
  expect(posicion('$70.000')).toBeGreaterThan(posicion('Urgencia')); // subtotal de Urgencia
  await cerrarSinGuardar(page, drawer);
});
