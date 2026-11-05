import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import { api } from '../apoyo.mjs';
import { abrirFicha, crearFicha, crearLinea, crearPlan, lineasDe, prestacion, registrarHooks } from './apoyo.mjs';

// Interruptor «Mostrar odontograma» del bloque: qué se ve con el dibujo oculto.

registrarHooks();

const interruptor = (popup) => popup.getByRole('switch', { name: 'Mostrar odontograma' });

// Ficha con un plan y Resina en los dientes 16 y 26.
const fichaConPrestaciones = async (request) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  await crearLinea(request, plan, resina, '16', 35000);
  await crearLinea(request, plan, resina, '26', 35000);
  return plan;
};

// Plan vacío con el dibujo ya oculto y una prestación elegida en el formulario de agregar.
const fichaOcultaConPrestacion = async (page, request, nombre) => {
  const plan = await crearPlan(request);
  await api(request, 'planesTratamiento:update', { params: { filterByTk: plan }, values: { mostrarOdontograma: false } });
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);
  await popup.locator('.ant-select').first().click();
  await page.keyboard.type(nombre);
  await page.keyboard.press('Enter');
  return { plan, popup };
};

const descargarPdf = async (page, popup) => {
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    popup.getByRole('button', { name: /Descargar presupuesto/ }).click(),
  ]);
  return (await fs.readFile(await descarga.path())).toString('latin1');
};

const imagenesDe = (contenido) => contenido.match(/\/Subtype\s*\/Image/g)?.length ?? 0;

const listaDeZonas = (popup) => popup.locator('[data-lista-zonas]');
const opciones = (page) => page.locator('.ant-select-dropdown:visible .ant-select-item-option');

const elegirZona = async (page, popup, busqueda, opcion) => {
  await listaDeZonas(popup).click();
  await page.keyboard.type(busqueda);
  await opciones(page).filter({ hasText: opcion }).click();
};

test('un plan sin elección guardada muestra el dibujo, con el interruptor encendido', async ({ page, request }) => {
  await fichaConPrestaciones(request);

  const popup = await abrirFicha(page);

  await expect(interruptor(popup)).toBeChecked();
  await expect(popup.getByRole('button', { name: 'Pieza 1.6', exact: true })).toBeVisible();
  await expect(popup.getByRole('tab', { name: 'Permanente' })).toBeVisible();
});

test('al apagar el interruptor desaparecen el dibujo, las pestañas, el título y el filtro', async ({ page, request }) => {
  await fichaConPrestaciones(request);
  const popup = await abrirFicha(page);
  await expect(popup.getByText('Filtrar solo lo que afecta a la selección')).toBeVisible();

  await interruptor(popup).click();

  await expect(interruptor(popup)).not.toBeChecked();
  await expect(popup.getByRole('button', { name: 'Pieza 1.6', exact: true })).toHaveCount(0);
  await expect(popup.getByRole('tab')).toHaveCount(0);
  await expect(popup.getByText('Selecciona un diente o una zona en el odontograma')).toHaveCount(0);
  await expect(popup.getByText('Filtrar solo lo que afecta a la selección')).toHaveCount(0);
});

test('si el filtro estaba activo, al apagar la tabla muestra todas las prestaciones sin resaltar ninguna', async ({ page, request }) => {
  await fichaConPrestaciones(request);
  const popup = await abrirFicha(page);
  const filas = popup.locator('.ant-table-row');
  await expect(filas).toHaveCount(2);

  await popup.getByRole('button', { name: 'Pieza 1.6', exact: true }).click();
  await popup.locator('[data-filtro]').click();
  await expect(filas).toHaveCount(1);
  await expect(filas.first()).toHaveAttribute('style', /22, 119, 255/);

  await interruptor(popup).click();

  await expect(filas).toHaveCount(2);
  await expect(filas.first()).not.toHaveAttribute('style', /22, 119, 255/);
  await expect(filas.last()).not.toHaveAttribute('style', /22, 119, 255/);
});

test('la elección se graba en el plan y sigue oculta al volver a abrir la ficha', async ({ page, request }) => {
  const plan = await fichaConPrestaciones(request);
  const popup = await abrirFicha(page);

  await interruptor(popup).click();

  await expect
    .poll(async () => (await api(request, 'planesTratamiento:get', { params: { filterByTk: plan } })).mostrarOdontograma)
    .toBe(false);

  await page.goto('/admin');
  const reabierto = await abrirFicha(page);
  await expect(interruptor(reabierto)).not.toBeChecked();
  await expect(reabierto.getByRole('button', { name: 'Pieza 1.6', exact: true })).toHaveCount(0);
});

test('al encenderlo, el dibujo pinta también lo agregado mientras estaba oculto', async ({ page, request }) => {
  await fichaConPrestaciones(request);
  const limpieza = await prestacion(request, 'Limpieza');
  const popup = await abrirFicha(page);
  await interruptor(popup).click();
  await expect(popup.getByRole('tab')).toHaveCount(0);

  await popup.locator('.ant-select').first().click();
  await page.keyboard.type('Limpieza');
  await page.keyboard.press('Enter');
  await popup.getByRole('button', { name: /Agregar/ }).click();
  await expect(popup.locator('.ant-table-row')).toHaveCount(3);

  await interruptor(popup).click();

  await expect(popup.getByRole('button', { name: 'Boca completa', exact: true }).locator('rect')).toHaveAttribute('fill', limpieza.color);
});

test('al cambiar el interruptor no se vuelven a pedir las prestaciones', async ({ page, request }) => {
  await fichaConPrestaciones(request);
  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(2);
  let pedidas = 0;
  page.on('request', (peticion) => {
    if (peticion.url().includes('prestacionesPlanTratamiento:list')) pedidas++;
  });

  await interruptor(popup).click();
  await expect(interruptor(popup)).not.toBeChecked();
  await page.waitForLoadState('networkidle');

  expect(pedidas).toBe(0);
});

test('en solo lectura, el interruptor se ve bloqueado con lo guardado en el plan', async ({ page, request }) => {
  const plan = await fichaConPrestaciones(request);
  await api(request, 'planesTratamiento:update', { params: { filterByTk: plan }, values: { mostrarOdontograma: false } });
  // El bloque se marca como solo lectura en la respuesta, sin tocar la página compartida.
  await page.route('**/api/uiSchemas:**', async (ruta) => {
    const respuesta = await ruta.fetch();
    const cuerpo = (await respuesta.text()).replaceAll('"odontograma":{"readOnly":false}', '"odontograma":{"readOnly":true}');
    await ruta.fulfill({ response: respuesta, body: cuerpo });
  });

  const popup = await abrirFicha(page);

  await expect(popup.getByRole('button', { name: /Agregar/ })).toHaveCount(0);
  await expect(interruptor(popup)).toBeDisabled();
  await expect(interruptor(popup)).not.toBeChecked();
  await expect(popup.getByRole('button', { name: 'Pieza 1.6', exact: true })).toHaveCount(0);
});

test('con el dibujo oculto, una prestación por diente ofrece solo dientes, que se buscan por número o por tipo', async ({ page, request }) => {
  const { popup } = await fichaOcultaConPrestacion(page, request, 'Resina');

  await listaDeZonas(popup).click();
  await expect(opciones(page).first()).toHaveText('1.1 · Incisivo central');
  for (const texto of await opciones(page).allTextContents()) expect(texto).toMatch(/^\d\.\d · /);

  await page.keyboard.type('16');
  await expect(opciones(page)).toHaveText(['1.6 · Primer molar']);

  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('canino');
  await expect(opciones(page).first()).toHaveText('1.3 · Canino');
  for (const texto of await opciones(page).allTextContents()) expect(texto).toMatch(/Canino$/);
});

test('con el dibujo oculto, al elegir un diente y sus caras se crea una sola línea con esa zona y esas caras', async ({ page, request }) => {
  const { plan, popup } = await fichaOcultaConPrestacion(page, request, 'Resina');

  await elegirZona(page, popup, '16', '1.6 · Primer molar');
  await popup.getByRole('button', { name: 'Mesial', exact: true }).click();
  await popup.getByRole('button', { name: 'Oclusal', exact: true }).click();
  await popup.getByRole('button', { name: /Agregar/ }).click();

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  await expect(popup.locator('.ant-table-row td').first()).toHaveText('Diente 16 · Mesial · Oclusal');
  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.zona, l.caras])).toEqual([['16', 'Mesial,Oclusal']]);
});

test('con el dibujo oculto, las caras quedan en una fila debajo del formulario aunque la pantalla sea ancha', async ({ page, request }) => {
  await page.setViewportSize({ width: 2560, height: 1080 });
  const { popup } = await fichaOcultaConPrestacion(page, request, 'Resina');

  await elegirZona(page, popup, '16', '1.6 · Primer molar');

  const agregar = await popup.getByRole('button', { name: /Agregar/ }).boundingBox();
  const mesial = await popup.getByRole('button', { name: 'Mesial', exact: true }).boundingBox();
  expect(mesial.y).toBeGreaterThanOrEqual(agregar.y + agregar.height);
});

test('con el dibujo oculto, una prestación por sextante ofrece solo los 6 sextantes y queda en el elegido', async ({ page, request }) => {
  const { plan, popup } = await fichaOcultaConPrestacion(page, request, 'Destartraje por sextante');

  await listaDeZonas(popup).click();
  await expect(opciones(page)).toHaveText([
    'Sextante 1 · 1.8 a 1.4',
    'Sextante 2 · 1.3 a 2.3',
    'Sextante 3 · 2.4 a 2.8',
    'Sextante 4 · 3.8 a 3.4',
    'Sextante 5 · 3.3 a 4.3',
    'Sextante 6 · 4.4 a 4.8',
  ]);
  await opciones(page).filter({ hasText: 'Sextante 2' }).click();
  await popup.getByRole('button', { name: /Agregar/ }).click();

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  expect((await lineasDe(request, plan)).map((l) => l.zona)).toEqual(['S2']);
});

test('con el dibujo oculto, una prestación por arcada ofrece solo las 2 arcadas y queda en la elegida', async ({ page, request }) => {
  const { plan, popup } = await fichaOcultaConPrestacion(page, request, 'Frenillos arcada');

  await listaDeZonas(popup).click();
  await expect(opciones(page)).toHaveText(['Arcada superior', 'Arcada inferior']);
  await opciones(page).filter({ hasText: 'Arcada inferior' }).click();
  await popup.getByRole('button', { name: /Agregar/ }).click();

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  expect((await lineasDe(request, plan)).map((l) => l.zona)).toEqual(['AI']);
});

test('con el dibujo oculto, una prestación de boca completa se agrega sin lista', async ({ page, request }) => {
  const { plan, popup } = await fichaOcultaConPrestacion(page, request, 'Limpieza');

  await expect(popup.getByRole('button', { name: /Agregar/ })).toBeEnabled();
  await expect(listaDeZonas(popup)).toHaveCount(0);
  await popup.getByRole('button', { name: /Agregar/ }).click();

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  expect((await lineasDe(request, plan)).map((l) => l.zona)).toEqual(['BOCA']);
});

test('con el dibujo oculto, sin zona elegida «Agregar» queda deshabilitado y el aviso no menciona el odontograma', async ({ page, request }) => {
  const { popup } = await fichaOcultaConPrestacion(page, request, 'Resina');

  await expect(popup.getByRole('button', { name: /Agregar/ })).toBeDisabled();
  await expect(popup.getByText('Elige la pieza para agregar esta prestación.')).toBeVisible();
  await expect(popup.getByText(/en el odontograma/)).toHaveCount(0);

  await elegirZona(page, popup, '16', '1.6 · Primer molar');

  await expect(popup.getByRole('button', { name: /Agregar/ })).toBeEnabled();
  await expect(popup.getByText('Elige la pieza para agregar esta prestación.')).toHaveCount(0);
});

test('con el dibujo oculto, el aviso de zona queda debajo del formulario aunque la pantalla sea ancha', async ({ page, request }) => {
  await page.setViewportSize({ width: 2560, height: 1080 });
  const { popup } = await fichaOcultaConPrestacion(page, request, 'Resina');

  const agregar = await popup.getByRole('button', { name: /Agregar/ }).boundingBox();
  const aviso = await popup.getByText('Elige la pieza para agregar esta prestación.').boundingBox();
  expect(aviso.y).toBeGreaterThanOrEqual(agregar.y + agregar.height);
});

test('con el dibujo oculto, el PDF sale con la tabla, sin imágenes y sin aviso de imágenes faltantes', async ({ page, request }) => {
  await fichaConPrestaciones(request);
  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(2);
  await interruptor(popup).click();
  await expect(popup.getByRole('tab')).toHaveCount(0);

  // El aviso se cierra solo: se vigila desde antes de la descarga para no perderlo.
  const aparecioElAviso = page
    .getByText('El PDF se generó sin una o más imágenes del odontograma.')
    .waitFor({ timeout: 5000 })
    .then(
      () => true,
      () => false,
    );
  const contenido = await descargarPdf(page, popup);

  expect(contenido).toContain('(Diente 16)');
  expect(contenido).toContain('(Diente 26)');
  expect(imagenesDe(contenido)).toBe(0);
  expect(await aparecioElAviso).toBe(false);
});

test('al volver a mostrar el dibujo, el PDF lo incluye de nuevo', async ({ page, request }) => {
  await fichaConPrestaciones(request);
  const popup = await abrirFicha(page);
  await expect(popup.locator('.ant-table-row')).toHaveCount(2);
  await interruptor(popup).click();
  await expect(popup.getByRole('tab')).toHaveCount(0);
  expect(imagenesDe(await descargarPdf(page, popup))).toBe(0);

  await interruptor(popup).click();
  await expect(popup.getByRole('tab', { name: 'Permanente' })).toBeVisible();

  expect(imagenesDe(await descargarPdf(page, popup))).toBe(1);
});

test('con el dibujo oculto, un diente temporal se puede buscar y registrar', async ({ page, request }) => {
  const { plan, popup } = await fichaOcultaConPrestacion(page, request, 'Resina');

  await elegirZona(page, popup, '54', '5.4 · Primer molar');
  await popup.getByRole('button', { name: /Agregar/ }).click();

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  const lineas = await lineasDe(request, plan);
  expect(lineas.map((l) => [l.zona, l.caras])).toEqual([['54', null]]);
});
