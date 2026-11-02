import { expect, test } from '@playwright/test';
import { agregarEnDiente, enviar, listar, nuevaFichaClinica, nuevas, prestacion, registrarHooks } from './apoyo.mjs';

// Dentición temporal (#5) en el formulario de la ficha clínica.

registrarHooks();

test('en el formulario de la ficha clínica se puede pasar a Temporal y agregar a un diente de leche, y se guarda con la ficha', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const drawer = await nuevaFichaClinica(page);

  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  const plan = drawer.locator('[data-odontograma]');
  await plan.getByRole('tab', { name: 'Temporal' }).click();
  await agregarEnDiente(page, plan, '8.5', 'Resina');
  await expect(plan.locator('.ant-table-row')).toHaveCount(1);
  await expect(plan.locator('.ant-table-row').first()).toContainText('Diente 85');

  // Antes de enviar no hay nada grabado.
  expect(await nuevas(request, 'prestacionesPlanTratamiento')).toHaveLength(0);
  await enviar(page, drawer);

  const [fichaClinica] = await nuevas(request, 'fichasClinicas');
  const [ficha] = await listar(request, 'fichaDental', { FK_fichaClinica: fichaClinica.id });
  const lineas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: ficha.FK_planTratamiento });
  expect(lineas.map((l) => [l.zona, l.FK_prestacion])).toEqual([['85', resina.id]]);
});
