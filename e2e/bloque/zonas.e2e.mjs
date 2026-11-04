import { expect, test } from '@playwright/test';
import { abrirFicha, colorDe, crearFicha, crearLinea, crearPlan, lineasDe, prestacion, registrarHooks } from './apoyo.mjs';

// Selectores de arcadas y boca completa bajo el dibujo (#4).

registrarHooks();

const selector = (popup, nombre) => popup.getByRole('button', { name: nombre, exact: true });
const colorDeSelector = (popup, nombre) => selector(popup, nombre).locator('rect').getAttribute('fill');

const elegirPrestacion = async (page, popup, nombre) => {
  await popup.locator('.ant-select').first().click();
  await page.keyboard.type(nombre);
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: nombre }).click();
};

const agregar = async (page, popup, nombre) => {
  await elegirPrestacion(page, popup, nombre);
  await popup.getByRole('button', { name: /Agregar/ }).click();
};

test('al elegir una arcada el título muestra la zona y se deselecciona el diente; al hacer clic en un diente, la selección vuelve a él', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);
  const pieza = popup.getByRole('button', { name: 'Pieza 1.6', exact: true });
  const arcada = popup.getByRole('button', { name: 'Arcada superior', exact: true });

  await pieza.click();
  await expect(popup.getByRole('heading', { name: 'Diente 16 · Primer molar' })).toBeVisible();

  await arcada.click();
  await expect(popup.getByRole('heading', { name: 'Arcada superior' })).toBeVisible();
  await expect(arcada).toHaveAttribute('aria-pressed', 'true');
  await expect(pieza).toHaveAttribute('aria-pressed', 'false');

  await pieza.click();
  await expect(popup.getByRole('heading', { name: 'Diente 16 · Primer molar' })).toBeVisible();
  await expect(arcada).toHaveAttribute('aria-pressed', 'false');
  await expect(pieza).toHaveAttribute('aria-pressed', 'true');
});

test('con una arcada seleccionada, agregar una prestación de arcada la registra en esa arcada y pinta su selector, no los dientes', async ({ page, request }) => {
  const frenillos = await prestacion(request, 'Frenillos arcada');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await selector(popup, 'Arcada inferior').click();
  await agregar(page, popup, 'Frenillos arcada');

  await expect.poll(() => colorDeSelector(popup, 'Arcada inferior')).toBe(frenillos.color);
  expect(await colorDe(popup, '3.5')).toBe('#fff');
  expect(await colorDeSelector(popup, 'Arcada superior')).not.toBe(frenillos.color);
  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.zona, l.FK_prestacion])).toEqual([['AI', frenillos.id]]);
});

test('una prestación de boca se agrega con cualquier selección o sin ninguna, queda en la boca y pinta su selector, no los dientes', async ({ page, request }) => {
  const limpieza = await prestacion(request, 'Limpieza');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await agregar(page, popup, 'Limpieza'); // sin selección
  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  await expect.poll(() => colorDeSelector(popup, 'Boca completa')).toBe(limpieza.color);
  expect(await colorDe(popup, '1.6')).toBe('#fff');

  await popup.getByRole('button', { name: 'Pieza 1.6', exact: true }).click(); // con un diente
  await agregar(page, popup, 'Limpieza');
  await expect(popup.locator('.ant-table-row')).toHaveCount(2);

  await selector(popup, 'Arcada superior').click(); // con una arcada
  await agregar(page, popup, 'Limpieza');
  await expect(popup.locator('.ant-table-row')).toHaveCount(3);

  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => l.zona)).toEqual(['BOCA', 'BOCA', 'BOCA']);
});

test('con varias prestaciones, el selector toma el color de la última y su tooltip las lista todas', async ({ page, request }) => {
  const [frenillos, limpieza, resina] = await Promise.all(['Frenillos arcada', 'Limpieza', 'Resina'].map((nombre) => prestacion(request, nombre)));
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, frenillos, 'AS', 450000);
  await crearLinea(request, plan, limpieza, 'AS', 30000);
  await crearLinea(request, plan, resina, 'AI', 35000);

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(3); // espera a que carguen las líneas

  expect(await colorDeSelector(popup, 'Arcada superior')).toBe(limpieza.color);

  await selector(popup, 'Arcada superior').hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('Arcada superior');
  await expect(tooltip).toContainText('Frenillos arcada');
  await expect(tooltip).toContainText('Limpieza');
  await expect(tooltip).not.toContainText('Resina');
});

test('un plan ya guardado con arcada y boca pinta sus selectores, sin etiqueta «Boca completa:»', async ({ page, request }) => {
  const [frenillos, limpieza] = await Promise.all(['Frenillos arcada', 'Limpieza'].map((nombre) => prestacion(request, nombre)));
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, frenillos, 'AS', 450000);
  await crearLinea(request, plan, limpieza, 'BOCA', 30000);

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(2); // espera a que carguen las líneas

  expect(await colorDeSelector(popup, 'Arcada superior')).toBe(frenillos.color);
  expect(await colorDeSelector(popup, 'Boca completa')).toBe(limpieza.color);
  expect(await colorDe(popup, '2.5')).toBe('#fff');
  await expect(popup.getByText('Boca completa:')).toHaveCount(0);
});

test('si la selección no corresponde al alcance, «Agregar» queda deshabilitado y un aviso indica qué seleccionar', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);
  const botonAgregar = popup.getByRole('button', { name: /Agregar/ });
  const avisoArcada = popup.getByText('Selecciona la arcada superior o inferior en el odontograma para agregar esta prestación.');
  const avisoDiente = popup.getByText('Selecciona el diente en el odontograma para agregar esta prestación.');

  // Prestación de arcada: sin selección, con un diente y, al final, con la arcada.
  await elegirPrestacion(page, popup, 'Frenillos arcada');
  await expect(avisoArcada).toBeVisible();
  await expect(botonAgregar).toBeDisabled();
  await popup.getByRole('button', { name: 'Pieza 1.6', exact: true }).click();
  await expect(avisoArcada).toBeVisible();
  await expect(botonAgregar).toBeDisabled();
  await selector(popup, 'Arcada superior').click();
  await expect(avisoArcada).toHaveCount(0);
  await expect(botonAgregar).toBeEnabled();

  // Prestación de diente con una arcada seleccionada.
  await elegirPrestacion(page, popup, 'Resina');
  await expect(avisoDiente).toBeVisible();
  await expect(botonAgregar).toBeDisabled();
  await popup.getByRole('button', { name: 'Pieza 1.6', exact: true }).click();
  await expect(avisoDiente).toHaveCount(0);
  await expect(botonAgregar).toBeEnabled();
});

test('el interruptor filtra la tabla con lo que abarca la zona seleccionada, sin filtrar el dibujo', async ({ page, request }) => {
  const [resina, frenillos, limpieza] = await Promise.all(['Resina', 'Frenillos arcada', 'Limpieza'].map((nombre) => prestacion(request, nombre)));
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  for (const [zona, p, precio] of [['16', resina, 35000], ['AS', frenillos, 450000], ['AI', frenillos, 450000], ['BOCA', limpieza, 30000]]) {
    await crearLinea(request, plan, p, zona, precio);
  }

  const popup = await abrirFicha(page);
  const filas = popup.locator('.ant-table-row');
  await expect(filas).toHaveCount(4); // espera a que carguen las líneas
  const zonasVisibles = async () => (await filas.locator('td:first-child').allTextContents()).sort();

  await expect(popup.getByRole('switch')).toBeDisabled();
  await selector(popup, 'Arcada superior').click();
  await popup.getByRole('switch').click();
  await expect(popup.getByText('Filtrar solo lo que afecta a la selección')).toBeVisible();
  await expect(filas).toHaveCount(2);
  expect(await zonasVisibles()).toEqual(['Arcada superior', 'Boca completa']);

  await selector(popup, 'Boca completa').click();
  await expect(filas).toHaveCount(1);
  expect(await zonasVisibles()).toEqual(['Boca completa']);

  await popup.getByRole('button', { name: 'Pieza 1.6', exact: true }).click();
  await expect(filas).toHaveCount(3);
  expect(await zonasVisibles()).toEqual(['Arcada superior', 'Boca completa', 'Diente 16']);

  // El dibujo no se filtra: los selectores y el diente siguen pintados.
  expect(await colorDeSelector(popup, 'Arcada inferior')).toBe(frenillos.color);
  expect(await colorDe(popup, '1.6')).toBe(resina.color);
});

test('el cuadrante propuesto sigue al diente, pero elegir una arcada o la boca no lo cambia', async ({ page, request }) => {
  const destartraje = await prestacion(request, 'Destartraje por cuadrante');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);
  const cuadrante = popup.locator('.ant-segmented-item-selected');

  await elegirPrestacion(page, popup, 'Destartraje por cuadrante');
  await expect(cuadrante).toHaveText('C1');

  await popup.getByRole('button', { name: 'Pieza 3.6', exact: true }).click();
  await expect(cuadrante).toHaveText('C3');

  await selector(popup, 'Arcada inferior').click();
  await expect(cuadrante).toHaveText('C3');
  await selector(popup, 'Boca completa').click();
  await expect(cuadrante).toHaveText('C3');

  await popup.getByRole('button', { name: /Agregar/ }).click();
  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.zona, l.FK_prestacion])).toEqual([['C3', destartraje.id]]);
});

test('cada prestación se muestra como etiqueta con su color en la columna Prestación de la tabla, y no bajo el dibujo', async ({ page, request }) => {
  const [resina, frenillos] = await Promise.all(['Resina', 'Frenillos arcada'].map((nombre) => prestacion(request, nombre)));
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000);
  await crearLinea(request, plan, frenillos, 'AS', 450000);

  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(2); // espera a que carguen las líneas

  const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
  const etiquetaDe = (zona) => popup.locator('.ant-table-row').filter({ hasText: zona }).locator('td').nth(1).locator('.ant-tag');

  await expect(etiquetaDe('Diente 16')).toHaveText('Resina');
  await expect(etiquetaDe('Diente 16')).toHaveCSS('border-top-color', rgb(resina.color));
  await expect(etiquetaDe('Diente 16')).toHaveCSS('color', 'rgb(51, 51, 51)'); // texto oscuro, legible sobre cualquier color
  await expect(etiquetaDe('Arcada superior')).toHaveText('Frenillos arcada');
  await expect(etiquetaDe('Arcada superior')).toHaveCSS('border-top-color', rgb(frenillos.color));

  await expect(popup.locator('.ant-tag').filter({ hasNot: page.locator('xpath=ancestor::td') })).toHaveCount(0);
});
