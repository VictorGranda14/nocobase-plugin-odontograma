import { expect, test } from '@playwright/test';
import { api, iniciarSesionApi, iniciarSesionUi } from '../apoyo.mjs';

// Apoyo de las pruebas del odontograma como campo del subformulario de la ficha dental, dentro del formulario
// de la ficha clínica: nada se graba hasta pulsar «Enviar», y entonces se graba todo junto.

const PAGINA = 'Fichas clínicas (E2E)';

// Estado compartido: lo asigna el beforeEach registrado por registrarHooks y lo leen los helpers.
export const ctx = {
  pacienteId: undefined,
  rutPaciente: undefined,
  ultimos: undefined, // ids más altos antes de la prueba, para saber qué creó y borrarlo
  fichasClinicasExtra: undefined, // ids creados por API en la preparación
};

export const listar = (request, coleccion, filtro = {}) =>
  api(request, `${coleccion}:list`, { params: { filter: JSON.stringify(filtro), paginate: 'false', sort: 'id' } });

const ultimoId = async (request, coleccion) =>
  (await api(request, `${coleccion}:list`, { params: { sort: '-id', pageSize: 1 } }))[0]?.id ?? 0;

export const prestacion = async (request, nombre) => (await listar(request, 'prestacionesDentales', { nombrePrestacion: nombre }))[0];

export const nuevas = async (request, coleccion) => listar(request, coleccion, { id: { $gt: ctx.ultimos[coleccion] } });

// Registra el beforeEach (sesión y preparación) y el afterEach (limpieza) en el archivo de pruebas que lo llame.
export const registrarHooks = () => {
  test.beforeEach(async ({ request, page }) => {
    await iniciarSesionApi(request);
    const [paciente] = await api(request, 'paciente:list', { params: { pageSize: 1, sort: 'id' } });
    ctx.pacienteId = paciente.id;
    ctx.rutPaciente = paciente.rutPaciente;
    ctx.ultimos = {};
    for (const coleccion of ['fichasClinicas', 'fichaDental', 'planesTratamiento', 'prestacionesPlanTratamiento']) {
      ctx.ultimos[coleccion] = await ultimoId(request, coleccion);
    }
    ctx.fichasClinicasExtra = [];

    await iniciarSesionUi(page);
  });

  // Borra por id todo lo creado durante la prueba: destroy con `filter` en la query no filtra y borraría todo.
  test.afterEach(async ({ request }) => {
    for (const coleccion of ['prestacionesPlanTratamiento', 'fichaDental', 'planesTratamiento', 'fichasClinicas']) {
      for (const registro of await nuevas(request, coleccion)) {
        await api(request, `${coleccion}:destroy`, { params: { filterByTk: registro.id }, values: {} });
      }
    }
  });
};

export const abrirPagina = async (page) => {
  await Promise.all([
    page.waitForResponse((respuesta) => respuesta.url().includes('fichasClinicas:list')),
    page.getByRole('menuitem', { name: PAGINA }).click(),
  ]);
  await page.waitForLoadState('networkidle');
};

export const formItem = (contenedor, etiqueta) => contenedor.locator('.ant-formily-item').filter({ hasText: etiqueta }).first();

const elegirOpcion = async (page, contenedor, etiqueta, opcion) => {
  await formItem(contenedor, etiqueta).locator('.ant-select').first().click();
  await page.locator('.ant-select-dropdown:visible').getByText(opcion, { exact: true }).click();
};

// Abre «Añadir nuevo» y completa la ficha clínica de Odontología y la fecha de la ficha dental.
export const nuevaFichaClinica = async (page, fecha = '2026-11-01') => {
  await abrirPagina(page);
  await page.getByRole('button', { name: /Añadir nuevo|Add new/ }).click();
  const drawer = page.locator('.ant-drawer-content').last();
  await expect(drawer).toBeVisible();
  await elegirOpcion(page, drawer, 'tipoFicha', 'Odontología');
  await elegirOpcion(page, drawer, 'Paciente Asociado', ctx.rutPaciente);
  const inputFecha = formItem(drawer, 'Fecha').locator('input').first();
  await inputFecha.click();
  await inputFecha.fill(fecha.split('-').reverse().join('/'));
  // Enter enviaría el formulario: se confirma el día en el calendario.
  await page.locator(`.ant-picker-dropdown:visible td[title="${fecha}"]`).click();
  return drawer;
};

// Los drawers de NocoBase se cierran haciendo clic fuera de ellos; puede pedir confirmar que se descartan los cambios.
export const cerrarSinGuardar = async (page, drawer) => {
  await page.locator('.ant-drawer-mask').last().click({ position: { x: 20, y: 20 } });
  const confirmar = page.locator('.ant-modal-confirm .ant-btn-primary');
  if (await confirmar.isVisible({ timeout: 2000 }).catch(() => false)) await confirmar.click();
  await expect(drawer).toBeHidden();
};

export const agregarEnDiente = async (page, plan, numero, nombre) => {
  await plan.getByRole('button', { name: `Pieza ${numero}`, exact: true }).click();
  await plan.locator('.ant-select').first().click();
  await page.keyboard.type(nombre);
  await page.keyboard.press('Enter');
  await plan.getByRole('button', { name: /Agregar/ }).click();
};

export const enviar = async (page, drawer) => {
  await Promise.all([
    page.waitForResponse((r) => /fichasClinicas:(create|update)/.test(r.url()) && r.request().method() === 'POST'),
    drawer.getByRole('button', { name: /Enviar|Submit/ }).click(),
  ]);
};

// Ficha clínica de Odontología guardada, con su ficha dental y un plan con prestaciones planificadas de Resina
// (por defecto 16 y 26, sin sección).
export const fichaClinicaConPlan = async (request, zonas = [['16'], ['26']]) => {
  const resina = await prestacion(request, 'Resina');
  const plan = await api(request, 'planesTratamiento:create', { values: { FK_paciente: ctx.pacienteId } });
  const lineas = [];
  for (const [zona, seccion = null] of zonas) {
    lineas.push(
      await api(request, 'prestacionesPlanTratamiento:create', {
        values: { FK_planTratamiento: plan.id, FK_prestacion: resina.id, zona, precio: 35000, estado: 'planificado', seccion },
      }),
    );
  }
  const fichaClinica = await api(request, 'fichasClinicas:create', { values: { tipoFicha: 'Odontología', FK_paciente: ctx.pacienteId } });
  const ficha = await api(request, 'fichaDental:create', {
    values: { fecha: '2026-10-30', FK_fichaClinica: fichaClinica.id, FK_planTratamiento: plan.id },
  });
  return { fichaClinica, ficha, plan, lineas };
};

export const editarFichaClinica = async (page, id, filas = 2) => {
  await abrirPagina(page);
  await page.locator(`.ant-table-row[data-row-key="${id}"]`).getByText('Editar', { exact: true }).click();
  const drawer = page.locator('.ant-drawer-content').last();
  const vista = drawer.locator('[data-odontograma]');
  await expect(vista.locator('.ant-table-row')).toHaveCount(filas);
  return { drawer, vista };
};

export const filaDeZona = (vista, etiqueta) => vista.locator('.ant-table-row').filter({ hasText: etiqueta });
