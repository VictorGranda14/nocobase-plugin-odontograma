import { expect, test } from '@playwright/test';
import { abrirFicha, agregarEnDiente, crearFicha, crearLinea, crearPlan, lineasDe, prestacion, registrarHooks } from './apoyo.mjs';

// Secciones del plan en el bloque: orden, subtotal, alta, renombrado y eliminación.

registrarHooks();

test('el bloque muestra las secciones en orden de creación con su subtotal y agrega a la sección indicada', async ({ page, request }) => {
  const [resina, frenillos] = await Promise.all(['Resina', 'Frenillos arcada'].map((nombre) => prestacion(request, nombre)));
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, frenillos, 'AS', 450000, { seccion: 'Ortodoncia' });
  await crearLinea(request, plan, resina, '16', 35000, { seccion: 'Urgencia' });
  await crearLinea(request, plan, resina, '26', 35000, { seccion: 'Urgencia' });

  const popup = await abrirFicha(page);
  const nombres = () => popup.locator('[data-seccion]').evaluateAll((nodos) => nodos.map((n) => n.getAttribute('data-seccion')));
  await expect.poll(nombres).toEqual(['Ortodoncia', 'Urgencia']);
  await expect(popup.locator('[data-seccion="Urgencia"] [data-subtotal]')).toHaveText('$70.000');

  await popup.getByPlaceholder('Sección (opcional)').fill('Urgencia');
  await agregarEnDiente(page, popup, '3.6', 'Resina');
  await expect(popup.locator('[data-seccion="Urgencia"] .ant-table-row')).toHaveCount(3);
  const lineas = await lineasDe(request, plan);
  expect(lineas.find((l) => l.zona === '36').seccion).toBe('Urgencia');
});

test('renombrar y eliminar una sección desde el bloque lo aplica al instante a sus prestaciones', async ({ page, request }) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000, { seccion: 'Etapa 1' });
  await crearLinea(request, plan, resina, '26', 35000, { seccion: 'Etapa 1' });
  const otra = await crearLinea(request, plan, resina, '36', 35000, { seccion: 'Etapa 2' });

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(3);
  const menu = async (nombre, opcion) => {
    await popup.getByRole('button', { name: `Opciones de la sección ${nombre}` }).click();
    await page.locator('.ant-dropdown:visible').getByText(opcion, { exact: true }).click();
  };

  await menu('Etapa 2', 'Renombrar');
  await page.locator('.ant-modal:visible').getByRole('textbox').fill('Ortodoncia');
  await page.locator('.ant-modal:visible').getByRole('button', { name: 'Renombrar' }).click();
  await expect(popup.locator('[data-seccion="Ortodoncia"]')).toBeVisible();

  await menu('Etapa 1', 'Eliminar');
  const confirmacion = page.locator('.ant-modal-confirm:visible');
  await expect(confirmacion).toContainText('Se eliminarán 2 prestaciones');
  await confirmacion.getByRole('button', { name: 'Eliminar' }).click();
  await expect(popup.locator('.ant-table-row')).toHaveCount(1);

  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.id, l.seccion])).toEqual([[otra.id, 'Ortodoncia']]);
});
