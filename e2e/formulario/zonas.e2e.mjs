import { expect, test } from '@playwright/test';
import { api } from '../apoyo.mjs';
import { editarFichaClinica, fichaClinicaConPlan, prestacion, registrarHooks } from './apoyo.mjs';

// Selectores de arcadas y boca completa en el formulario de la ficha clínica (#4).

registrarHooks();

test('al editar una ficha clínica, el selector toma el color de la última prestación aunque la primera se haya modificado después', async ({ page, request }) => {
  const [resina, limpieza] = await Promise.all(['Resina', 'Limpieza'].map((nombre) => prestacion(request, nombre)));
  const { fichaClinica, plan, lineas } = await fichaClinicaConPlan(request, [['AS']]);
  await api(request, 'prestacionesPlanTratamiento:create', {
    values: { FK_planTratamiento: plan.id, FK_prestacion: limpieza.id, zona: 'AS', precio: 30000, estado: 'planificado' },
  });
  // Actualizar la primera la mueve de lugar físico en Postgres: sin un orden explícito, volvería después de la segunda.
  await api(request, 'prestacionesPlanTratamiento:update', { params: { filterByTk: lineas[0].id }, values: { precio: 36000 } });

  const { vista } = await editarFichaClinica(page, fichaClinica.id);

  const colorDeSelector = vista.getByRole('button', { name: 'Arcada superior', exact: true }).locator('rect');
  expect(resina.color).not.toBe(limpieza.color);
  await expect(colorDeSelector).toHaveAttribute('fill', limpieza.color);
});
