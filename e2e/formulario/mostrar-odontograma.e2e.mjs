import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import { IMAGENES_MEMBRETE, api } from '../apoyo.mjs';
import { cerrarSinGuardar, ctx, editarFichaClinica, enviar, fichaClinicaConPlan, nuevaFichaClinica, nuevas, prestacion, registrarHooks } from './apoyo.mjs';

// Interruptor «Mostrar odontograma» en el formulario: la elección se graba con el resto del plan al pulsar «Enviar».

registrarHooks();

const interruptor = (vista) => vista.getByRole('switch', { name: 'Mostrar odontograma' });
const dibujo = (vista) => vista.getByRole('button', { name: 'Pieza 1.6', exact: true });
const mostrarDelPlan = async (request, id) => (await api(request, 'planesTratamiento:get', { params: { filterByTk: id } })).mostrarOdontograma;

test('al apagar el interruptor no se graba nada hasta pulsar Enviar; después, el plan queda oculto al reabrir la edición', async ({ page, request }) => {
  const { fichaClinica, plan } = await fichaClinicaConPlan(request);
  const { drawer, vista } = await editarFichaClinica(page, fichaClinica.id);

  await interruptor(vista).click();
  await expect(dibujo(vista)).toHaveCount(0);
  expect(await mostrarDelPlan(request, plan.id)).toBeNull();

  await enviar(page, drawer);
  await expect.poll(() => mostrarDelPlan(request, plan.id)).toBe(false);

  await page.goto('/admin');
  const reabierta = await editarFichaClinica(page, fichaClinica.id);
  await expect(interruptor(reabierta.vista)).not.toBeChecked();
  await expect(dibujo(reabierta.vista)).toHaveCount(0);
});

test('si se cierra sin guardar, el plan conserva lo que tenía', async ({ page, request }) => {
  const { fichaClinica, plan } = await fichaClinicaConPlan(request);
  const { drawer, vista } = await editarFichaClinica(page, fichaClinica.id);

  await interruptor(vista).click();
  await expect(dibujo(vista)).toHaveCount(0);
  await cerrarSinGuardar(page, drawer);

  expect(await mostrarDelPlan(request, plan.id)).toBeNull();
});

test('un plan nuevo creado con el dibujo oculto guarda la elección y sus prestaciones, elegidas desde la lista', async ({ page, request }) => {
  const drawer = await nuevaFichaClinica(page);
  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  const vista = drawer.locator('[data-odontograma]');
  await interruptor(vista).click();
  await expect(dibujo(vista)).toHaveCount(0);

  await vista.locator('.ant-select').first().click();
  await page.keyboard.type('Resina');
  await page.keyboard.press('Enter');
  await vista.locator('[data-lista-zonas]').click();
  await page.keyboard.type('16');
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '1.6 · Primer molar' }).click();
  await vista.getByRole('button', { name: 'Mesial', exact: true }).click();
  await vista.getByRole('button', { name: /Agregar/ }).click();
  await expect(vista.locator('.ant-table-row')).toHaveCount(1);
  await enviar(page, drawer);

  const [plan] = await nuevas(request, 'planesTratamiento');
  expect(plan.mostrarOdontograma).toBe(false);
  const lineas = await nuevas(request, 'prestacionesPlanTratamiento');
  expect(lineas.map((l) => [l.FK_planTratamiento, l.zona, l.caras])).toEqual([[plan.id, '16', 'Mesial']]);
});

test('al continuar un plan guardado como oculto, se abre oculto', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await api(request, 'planesTratamiento:create', { values: { FK_paciente: ctx.pacienteId, mostrarOdontograma: false } });
  await api(request, 'prestacionesPlanTratamiento:create', {
    values: { FK_planTratamiento: plan.id, FK_prestacion: resina.id, zona: '16', precio: 35000, estado: 'planificado' },
  });
  const drawer = await nuevaFichaClinica(page);

  await drawer.getByRole('combobox').last().click();
  await page.locator('.ant-select-dropdown:visible').getByText(/1 prestación$/).first().click();
  await drawer.getByRole('button', { name: 'Continuar plan' }).click();
  const vista = drawer.locator('[data-odontograma]');
  await expect(vista.locator('.ant-table-row')).toHaveCount(1);

  await expect(interruptor(vista)).not.toBeChecked();
  await expect(dibujo(vista)).toHaveCount(0);
  await cerrarSinGuardar(page, drawer);
});

test('con el dibujo oculto, el PDF del formulario sale sin odontograma y sin aviso', async ({ page, request }) => {
  const { fichaClinica } = await fichaClinicaConPlan(request);
  const { drawer, vista } = await editarFichaClinica(page, fichaClinica.id);
  await interruptor(vista).click();
  await expect(dibujo(vista)).toHaveCount(0);

  // El aviso se cierra solo: se vigila desde antes de la descarga para no perderlo.
  const aparecioElAviso = page
    .getByText('El PDF se generó sin una o más imágenes del odontograma.')
    .waitFor({ timeout: 5000 })
    .then(
      () => true,
      () => false,
    );
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    vista.getByRole('button', { name: /Descargar presupuesto/ }).click(),
  ]);
  const contenido = (await fs.readFile(await descarga.path())).toString('latin1');

  expect(contenido).toContain('(Diente 16)');
  expect(contenido.match(/\/Subtype\s*\/Image/g)?.length ?? 0).toBe(IMAGENES_MEMBRETE);
  expect(await aparecioElAviso).toBe(false);
  await cerrarSinGuardar(page, drawer);
});
