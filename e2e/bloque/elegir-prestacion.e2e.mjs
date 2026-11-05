import { expect, test } from '@playwright/test';
import { api } from '../apoyo.mjs';
import { abrirFicha, crearFicha, crearPlan, lineasDe, registrarHooks } from './apoyo.mjs';

// Selector de prestación en dos columnas: alcances a la izquierda y sus prestaciones a la derecha.

registrarHooks();

const CATALOGO = [
  { id: 9001, nombrePrestacion: 'Endodoncia', alcance: 'diente', precio: 180000 },
  { id: 9002, nombrePrestacion: 'Resina', alcance: 'diente', precio: 35000 },
  { id: 9003, nombrePrestacion: 'Destartraje', alcance: 'sextante', precio: 30000 },
  { id: 9004, nombrePrestacion: 'Prótesis', alcance: 'arcada', precio: 250000 },
  { id: 9005, nombrePrestacion: 'Limpieza', alcance: 'boca', precio: 25000 },
];

// El catálogo se simula en la respuesta, sin tocar los datos compartidos.
const simularCatalogo = (page, catalogo) =>
  page.route('**/api/prestacionesDentales:list**', (ruta) => ruta.fulfill({ json: { data: catalogo, meta: {} } }));

const abrirSelector = async (page, request) => {
  await crearFicha(request, { plan: await crearPlan(request) });
  const popup = await abrirFicha(page);
  await popup.locator('.ant-select').first().click();
  return popup;
};

const alcances = (page) => page.locator('.ant-select-dropdown:visible [data-alcance]');
const prestaciones = (page) => page.locator('.ant-select-dropdown:visible [data-prestacion]');

test('al abrir, se ven los alcances con prestaciones activas y solo las prestaciones de «Por diente»', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);

  await abrirSelector(page, request);

  await expect(alcances(page)).toHaveText(['Por diente', 'Por sextante', 'Por arcada', 'Boca completa']);
  await expect(prestaciones(page)).toHaveText([/^Endodoncia.*\$180\.000$/, /^Resina.*\$35\.000$/]);
});

test('un alcance sin prestaciones activas no aparece', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO.filter((p) => p.alcance !== 'arcada'));

  await abrirSelector(page, request);

  await expect(alcances(page)).toHaveText(['Por diente', 'Por sextante', 'Boca completa']);
});

test('si «Por diente» no tiene prestaciones, se abre en el primer alcance que tenga', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO.filter((p) => p.alcance !== 'diente'));

  await abrirSelector(page, request);

  await expect(alcances(page).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(prestaciones(page)).toHaveText([/^Destartraje/]);
});

test('al pasar el mouse por otro alcance, la lista de prestaciones no cambia', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  await abrirSelector(page, request);

  await alcances(page).filter({ hasText: 'Por arcada' }).hover();

  await expect(alcances(page).filter({ hasText: 'Por diente' })).toHaveAttribute('aria-pressed', 'true');
  await expect(prestaciones(page)).toHaveText([/^Endodoncia/, /^Resina/]);
});

test('al hacer clic en otro alcance, cambia la lista de prestaciones', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  await abrirSelector(page, request);

  await alcances(page).filter({ hasText: 'Por sextante' }).click();

  await expect(prestaciones(page)).toHaveText([/^Destartraje/]);
});

test('tras un clic real en un alcance, el selector sigue abierto y se puede seguir escribiendo', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  await abrirSelector(page, request);

  await alcances(page).filter({ hasText: 'Por sextante' }).click();
  await expect(prestaciones(page)).toHaveText([/^Destartraje/]);

  await page.keyboard.type('Limp');

  await expect(page.locator('.ant-select-dropdown:visible .ant-select-item-option')).toHaveText([/Limpieza/]);
});

test('con un catálogo largo, el desplegable no crece y se llega a la última prestación con scroll', async ({ page, request }) => {
  const largo = Array.from({ length: 30 }, (_, i) => ({ id: 9100 + i, nombrePrestacion: `Prestación ${i + 1}`, alcance: 'diente', precio: 1000 }));
  await simularCatalogo(page, largo);
  const popup = await abrirSelector(page, request);

  await expect(prestaciones(page)).toHaveCount(30);
  expect((await page.locator('.ant-select-dropdown:visible').boundingBox()).height).toBeLessThanOrEqual(300);

  await prestaciones(page).last().click();

  await expect(popup.locator('.ant-select-selection-item').first()).toHaveText('Prestación 30 · Por diente');
});

test('volver a elegir la misma prestación en las columnas conserva el precio editado', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  const popup = await abrirSelector(page, request);
  await prestaciones(page).filter({ hasText: 'Resina' }).click();
  await popup.getByPlaceholder('Precio').fill('20000');
  await popup.getByPlaceholder('Precio').blur();

  await popup.locator('.ant-select').first().click();
  await prestaciones(page).filter({ hasText: 'Resina' }).click();

  await expect(popup.getByPlaceholder('Precio')).toHaveValue('$20.000');
});

test('la prestación ya elegida se destaca en las columnas', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  const popup = await abrirSelector(page, request);
  await prestaciones(page).filter({ hasText: 'Resina' }).click();

  await popup.locator('.ant-select').first().click();

  await expect(prestaciones(page).filter({ hasText: 'Resina' })).toHaveCSS('font-weight', '600');
  await expect(prestaciones(page).filter({ hasText: 'Endodoncia' })).toHaveCSS('font-weight', '400');
});

test('un nombre muy largo no recorta el alcance ni el precio del resultado', async ({ page, request }) => {
  const nombre = 'Prestación con un nombre verdaderamente largo para comprobar que no recorta el precio';
  await simularCatalogo(page, [{ id: 9200, nombrePrestacion: nombre, alcance: 'sextante', precio: 180000 }]);
  await abrirSelector(page, request);

  await page.keyboard.type('verdaderamente');

  const resultado = page.locator('.ant-select-dropdown:visible .ant-select-item-option');
  await expect(resultado).toHaveCount(1);
  const fila = await resultado.boundingBox();
  const detalle = await resultado.getByText('Por sextante · $180.000').boundingBox();
  expect(detalle.x + detalle.width).toBeLessThanOrEqual(fila.x + fila.width);
});

test('después de agregar una prestación, el selector se abre en el alcance de esa prestación', async ({ page, request }) => {
  const popup = await abrirSelector(page, request);
  const selector = popup.locator('.ant-select').first();
  const marcado = () => alcances(page).filter({ hasText: 'Boca completa' });

  await marcado().click();
  await prestaciones(page).filter({ hasText: 'Limpieza' }).click();
  await popup.getByRole('button', { name: /Agregar/ }).click();
  await expect(popup.locator('.ant-table-row')).toHaveCount(1);

  await selector.click();
  await expect(marcado()).toHaveAttribute('aria-pressed', 'true');

  // Marcar otro alcance sin elegir nada no cambia con cuál se vuelve a abrir.
  await alcances(page).filter({ hasText: 'Por diente' }).click();
  await page.keyboard.press('Escape');
  await selector.click();
  await expect(marcado()).toHaveAttribute('aria-pressed', 'true');
});

const resultados = (page) => page.locator('.ant-select-dropdown:visible .ant-select-item-option');

test('al escribir, aparecen coincidencias de todo el catálogo, aunque esté marcado otro alcance, con su alcance y su precio', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  await abrirSelector(page, request);
  await expect(alcances(page).filter({ hasText: 'Por diente' })).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.type('es');

  await expect(resultados(page)).toHaveText([/Resina.*Por diente.*\$35\.000/, /Destartraje.*Por sextante.*\$30\.000/, /Prótesis.*Por arcada.*\$250\.000/]);
  await expect(page.locator('.ant-select-dropdown:visible .ant-select-item-group')).toHaveCount(0);
  await expect(alcances(page)).toHaveCount(0);
});

test('escribir un precio o un alcance no encuentra prestaciones', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  await abrirSelector(page, request);

  const desplegable = page.locator('.ant-select-dropdown:visible');

  await page.keyboard.type('35.000');
  await expect(desplegable).toContainText('Sin resultados');
  await expect(resultados(page)).toHaveCount(0);

  await page.keyboard.press('Control+A');
  await page.keyboard.type('Por diente');
  await expect(desplegable).toContainText('Sin resultados');
  await expect(resultados(page)).toHaveCount(0);
});

test('se puede elegir un resultado con el mouse', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  const popup = await abrirSelector(page, request);

  await page.keyboard.type('Limp');
  await resultados(page).filter({ hasText: 'Limpieza' }).click();

  await expect(popup.locator('.ant-select-selection-item').first()).toContainText('Limpieza');
  await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0);
  await expect(popup.getByRole('button', { name: /Agregar/ })).toBeEnabled();
});

test('se puede elegir un resultado con las flechas y Enter', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  const popup = await abrirSelector(page, request);

  await page.keyboard.type('es');
  await expect(resultados(page)).toHaveCount(3);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(popup.locator('.ant-select-selection-item').first()).toContainText('Destartraje');
  await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0);
});

test('sin coincidencias, se avisa «Sin resultados»', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  await abrirSelector(page, request);

  await page.keyboard.type('xyz');

  await expect(page.locator('.ant-select-dropdown:visible')).toContainText('Sin resultados');
});

test('al borrar la búsqueda, vuelven las dos columnas', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  await abrirSelector(page, request);

  await page.keyboard.type('Li');
  await expect(alcances(page)).toHaveCount(0);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');

  await expect(alcances(page)).toHaveCount(4);
  await expect(prestaciones(page)).toHaveText([/^Endodoncia/, /^Resina/]);
});

test('la prestación elegida se muestra con su nombre y su alcance, y el precio queda sugerido', async ({ page, request }) => {
  await simularCatalogo(page, CATALOGO);
  const popup = await abrirSelector(page, request);

  await alcances(page).filter({ hasText: 'Boca completa' }).click();
  await prestaciones(page).filter({ hasText: 'Limpieza' }).click();

  await expect(popup.locator('.ant-select-selection-item').first()).toHaveText('Limpieza · Boca completa');
  await expect(popup.getByPlaceholder('Precio')).toHaveValue('$25.000');
});

test('con el dibujo visible, una prestación de diente elegida en las columnas se agrega en la pieza seleccionada, con sus caras', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  const circulo = popup.getByRole('button', { name: 'Caras de la pieza 1.6', exact: true });
  await circulo.getByLabel('Mesial', { exact: true }).click();
  await popup.locator('.ant-select').first().click();
  await prestaciones(page).filter({ hasText: 'Resina' }).click();
  await popup.getByRole('button', { name: /Agregar/ }).click();

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  expect((await lineasDe(request, plan)).map((l) => [l.zona, l.caras])).toEqual([['16', 'Mesial']]);
});

test('con el dibujo oculto, una prestación elegida en las columnas abre la lista de zonas y se agrega en la zona elegida', async ({ page, request }) => {
  const plan = await crearPlan(request);
  await api(request, 'planesTratamiento:update', { params: { filterByTk: plan }, values: { mostrarOdontograma: false } });
  await crearFicha(request, { plan });
  const popup = await abrirFicha(page);

  await popup.locator('.ant-select').first().click();
  await alcances(page).filter({ hasText: 'Por arcada' }).click();
  await prestaciones(page).filter({ hasText: 'Frenillos arcada' }).click();
  await popup.locator('[data-lista-zonas]').click();
  await resultados(page).filter({ hasText: 'Arcada inferior' }).click();
  await popup.getByRole('button', { name: /Agregar/ }).click();

  await expect(popup.locator('.ant-table-row')).toHaveCount(1);
  expect((await lineasDe(request, plan)).map((l) => l.zona)).toEqual(['AI']);
});
