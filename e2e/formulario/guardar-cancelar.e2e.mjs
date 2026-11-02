import { expect, test } from '@playwright/test';
import {
  agregarEnDiente,
  cerrarSinGuardar,
  editarFichaClinica,
  enviar,
  fichaClinicaConPlan,
  filaDeZona,
  listar,
  nuevaFichaClinica,
  nuevas,
  registrarHooks,
} from './apoyo.mjs';

// Guardar y cancelar en el formulario: cerrar sin guardar, editar y cancelar la edición.

registrarHooks();

test('cerrar el formulario sin guardar no graba ficha, plan ni prestaciones', async ({ page, request }) => {
  const drawer = await nuevaFichaClinica(page);
  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  const vista = drawer.locator('[data-odontograma]');
  await agregarEnDiente(page, vista, '1.6', 'Resina');
  await expect(vista.locator('.ant-table-row')).toHaveCount(1);

  await cerrarSinGuardar(page, drawer);

  for (const coleccion of ['fichasClinicas', 'fichaDental', 'planesTratamiento', 'prestacionesPlanTratamiento']) {
    expect(await nuevas(request, coleccion), coleccion).toHaveLength(0);
  }
});

test('editar una ficha clínica guarda las prestaciones agregadas, quitadas y realizadas al pulsar Enviar', async ({ page, request }) => {
  const { fichaClinica, ficha, plan, lineas } = await fichaClinicaConPlan(request);
  const { drawer, vista } = await editarFichaClinica(page, fichaClinica.id);

  await agregarEnDiente(page, vista, '3.6', 'Resina');
  await filaDeZona(vista, '26').getByRole('button', { name: 'Eliminar' }).click();
  await page.locator('.ant-popconfirm:visible').getByRole('button', { name: 'Eliminar' }).click();
  await filaDeZona(vista, '16').getByText('Planificado', { exact: true }).click();
  await expect(vista.locator('.ant-table-row')).toHaveCount(2);
  await enviar(page, drawer);

  const guardadas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: plan.id });
  expect(guardadas.map((l) => [l.zona, l.estado, l.FK_fichaDentalRealizacion])).toEqual([
    ['16', 'realizado', ficha.id],
    ['36', 'planificado', null],
  ]);
  expect(await listar(request, 'prestacionesPlanTratamiento', { id: lineas[1].id })).toHaveLength(0);
});

test('cancelar la edición de una ficha clínica deja el plan como estaba', async ({ page, request }) => {
  const { fichaClinica, plan } = await fichaClinicaConPlan(request);
  const { drawer, vista } = await editarFichaClinica(page, fichaClinica.id);

  await agregarEnDiente(page, vista, '3.6', 'Resina');
  await filaDeZona(vista, '26').getByRole('button', { name: 'Eliminar' }).click();
  await page.locator('.ant-popconfirm:visible').getByRole('button', { name: 'Eliminar' }).click();
  await expect(vista.locator('.ant-table-row')).toHaveCount(2);
  await cerrarSinGuardar(page, drawer);

  const lineas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: plan.id });
  expect(lineas.map((l) => [l.zona, l.estado])).toEqual([
    ['16', 'planificado'],
    ['26', 'planificado'],
  ]);
});
