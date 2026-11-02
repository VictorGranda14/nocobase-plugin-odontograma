import { expect, test } from '@playwright/test';
import { api } from '../apoyo.mjs';
import { agregarEnDiente, ctx, enviar, listar, nuevaFichaClinica, nuevas, prestacion, registrarHooks } from './apoyo.mjs';

// Crear una ficha clínica desde el formulario: con plan nuevo y continuando un plan del paciente.

registrarHooks();

test('crear una ficha clínica con plan nuevo guarda ficha, ficha dental, plan y prestaciones juntos, y la realizada queda en esa atención', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const drawer = await nuevaFichaClinica(page);

  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  const plan = drawer.locator('[data-odontograma]');
  await agregarEnDiente(page, plan, '1.6', 'Resina');
  await agregarEnDiente(page, plan, '2.6', 'Resina');
  await expect(plan.locator('.ant-table-row')).toHaveCount(2);
  await plan.locator('.ant-table-row').first().getByText('Planificado', { exact: true }).click();

  // Antes de enviar no hay nada grabado.
  expect(await nuevas(request, 'planesTratamiento')).toHaveLength(0);
  await enviar(page, drawer);

  const [fichaClinica] = await nuevas(request, 'fichasClinicas');
  expect(fichaClinica).toMatchObject({ tipoFicha: 'Odontología', FK_paciente: ctx.pacienteId });
  const fichas = await listar(request, 'fichaDental', { FK_fichaClinica: fichaClinica.id });
  expect(fichas).toHaveLength(1);
  const [ficha] = fichas;
  expect(ficha.fecha).toBe('2026-11-01');
  expect((await api(request, 'planesTratamiento:get', { params: { filterByTk: ficha.FK_planTratamiento } })).FK_paciente).toBe(ctx.pacienteId);
  const lineas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: ficha.FK_planTratamiento });
  expect(lineas.map((l) => [l.zona, l.FK_prestacion, l.estado, l.FK_fichaDentalRealizacion])).toEqual([
    ['16', resina.id, 'realizado', ficha.id],
    ['26', resina.id, 'planificado', null],
  ]);
});

test('crear una ficha clínica continuando un plan del paciente muestra lo anterior y agrega al mismo plan', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await api(request, 'planesTratamiento:create', { values: { FK_paciente: ctx.pacienteId } });
  await api(request, 'prestacionesPlanTratamiento:create', {
    values: { FK_planTratamiento: plan.id, FK_prestacion: resina.id, zona: '16', precio: 35000, estado: 'planificado' },
  });
  const drawer = await nuevaFichaClinica(page);

  await drawer.getByRole('combobox').last().click();
  await page.locator('.ant-select-dropdown:visible').getByText(/1 prestación$/).first().click();
  await drawer.getByRole('button', { name: 'Continuar plan' }).click();
  const vista = drawer.locator('[data-odontograma]');
  await expect(vista.locator('.ant-table-row')).toHaveCount(1);
  await agregarEnDiente(page, vista, '2.6', 'Resina');
  await expect(vista.locator('.ant-table-row')).toHaveCount(2);
  await enviar(page, drawer);

  const [fichaClinica] = await nuevas(request, 'fichasClinicas');
  const [ficha] = await listar(request, 'fichaDental', { FK_fichaClinica: fichaClinica.id });
  expect(ficha.FK_planTratamiento).toBe(plan.id);
  expect((await nuevas(request, 'planesTratamiento')).map((p) => p.id)).toEqual([plan.id]);
  const lineas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: plan.id });
  expect(lineas.map((l) => l.zona)).toEqual(['16', '26']);
});
