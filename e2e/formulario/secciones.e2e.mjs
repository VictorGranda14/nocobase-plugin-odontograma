import { expect, test } from '@playwright/test';
import { agregarEnDiente, editarFichaClinica, enviar, fichaClinicaConPlan, listar, nuevaFichaClinica, nuevas, registrarHooks } from './apoyo.mjs';

// Secciones del plan en el formulario: crear, renombrar y eliminar.

registrarHooks();

// Secciones de la vista en orden, con su texto (nombre y subtotal).
const secciones = (vista) => vista.locator('[data-seccion]').evaluateAll((nodos) => nodos.map((n) => n.getAttribute('data-seccion')));
const subtotal = (vista, nombre) => vista.locator(`[data-seccion="${nombre}"] [data-subtotal]`);

test('crear secciones agrupa las prestaciones con su subtotal y se guardan con la ficha clínica', async ({ page, request }) => {
  const drawer = await nuevaFichaClinica(page);
  await drawer.getByRole('button', { name: 'Crear plan nuevo' }).click();
  const vista = drawer.locator('[data-odontograma]');
  const seccion = vista.getByPlaceholder('Sección (opcional)');

  await seccion.fill('Etapa 1');
  await agregarEnDiente(page, vista, '1.6', 'Resina');
  await agregarEnDiente(page, vista, '2.6', 'Resina');
  await seccion.fill('Etapa 2');
  await agregarEnDiente(page, vista, '3.6', 'Resina');
  await seccion.fill('');
  await agregarEnDiente(page, vista, '4.6', 'Resina');

  await expect.poll(() => secciones(vista)).toEqual(['Etapa 1', 'Etapa 2', '']);
  await expect(subtotal(vista, 'Etapa 1')).toHaveText('$70.000');
  await expect(subtotal(vista, 'Etapa 2')).toHaveText('$35.000');
  await expect(vista.locator('[data-seccion=""]')).toContainText('Sin sección');
  await enviar(page, drawer);

  const [fichaClinica] = await nuevas(request, 'fichasClinicas');
  const [ficha] = await listar(request, 'fichaDental', { FK_fichaClinica: fichaClinica.id });
  const lineas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: ficha.FK_planTratamiento });
  expect(lineas.map((l) => [l.zona, l.seccion ?? null])).toEqual([
    ['16', 'Etapa 1'],
    ['26', 'Etapa 1'],
    ['36', 'Etapa 2'],
    ['46', null],
  ]);

  // Al reabrir se ven las mismas secciones, en orden de creación.
  await expect(drawer).toBeHidden();
  const fila = page.locator(`.ant-table-row[data-row-key="${fichaClinica.id}"]`);
  await expect(fila).toBeVisible();
  await fila.getByText('Editar', { exact: true }).click();
  const reabierta = page.locator('.ant-drawer-content').last().locator('[data-odontograma]');
  await expect.poll(() => secciones(reabierta)).toEqual(['Etapa 1', 'Etapa 2', '']);
  await expect(subtotal(reabierta, 'Etapa 1')).toHaveText('$70.000');
});

// Menú de una sección: «Renombrar» o «Eliminar».
const menuSeccion = async (page, vista, nombre, opcion) => {
  await vista.getByRole('button', { name: `Opciones de la sección ${nombre}` }).click();
  await page.locator('.ant-dropdown:visible').getByText(opcion, { exact: true }).click();
};

const renombrarSeccion = async (page, vista, nombre, nuevo) => {
  await menuSeccion(page, vista, nombre, 'Renombrar');
  const dialogo = page.locator('.ant-modal:visible');
  await dialogo.getByRole('textbox').fill(nuevo);
  await dialogo.getByRole('button', { name: 'Renombrar' }).click();
};

test('renombrar y eliminar secciones desde su menú se guarda con la ficha clínica', async ({ page, request }) => {
  const { fichaClinica, plan } = await fichaClinicaConPlan(request, [['16', 'Etapa 1'], ['26', 'Etapa 1'], ['36', 'Etapa 2']]);
  const { drawer, vista } = await editarFichaClinica(page, fichaClinica.id, 3);

  // Un nombre ya usado se rechaza.
  await renombrarSeccion(page, vista, 'Etapa 1', 'Etapa 2');
  await expect(page.getByText('Ya existe la sección «Etapa 2»')).toBeVisible();
  await page.locator('.ant-modal:visible').getByRole('button', { name: 'Cancelar' }).click();

  await renombrarSeccion(page, vista, 'Etapa 1', 'Urgencia');
  await expect.poll(() => secciones(vista)).toEqual(['Urgencia', 'Etapa 2']);

  // Cancelar la eliminación no cambia nada; confirmarla avisa cuántas prestaciones se borran.
  await menuSeccion(page, vista, 'Etapa 2', 'Eliminar');
  await page.locator('.ant-modal-confirm:visible').getByRole('button', { name: 'Cancelar' }).click();
  await expect(vista.locator('.ant-table-row')).toHaveCount(3);
  await menuSeccion(page, vista, 'Etapa 2', 'Eliminar');
  const confirmacion = page.locator('.ant-modal-confirm:visible');
  await expect(confirmacion).toContainText('Se eliminará 1 prestación');
  await confirmacion.getByRole('button', { name: 'Eliminar' }).click();
  await expect.poll(() => secciones(vista)).toEqual(['Urgencia']);
  await enviar(page, drawer);

  const lineas = await listar(request, 'prestacionesPlanTratamiento', { FK_planTratamiento: plan.id });
  expect(lineas.map((l) => [l.zona, l.seccion])).toEqual([
    ['16', 'Urgencia'],
    ['26', 'Urgencia'],
  ]);
});
