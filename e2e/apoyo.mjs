import { expect } from '@playwright/test';

// Apoyo común a las pruebas del bloque y del formulario: credenciales, sesión y llamadas a la API.

// Todo PDF lleva el logo y la franja del membrete; los odontogramas se suman a estas imágenes.
export const IMAGENES_MEMBRETE = 2;

export const USUARIO = process.env.E2E_USER || 'admin@nocobase.com';
export const CLAVE = process.env.E2E_PASSWORD || 'admin123';

// Estado compartido: `token` lo asigna iniciarSesionApi en el beforeEach de cada prueba.
export const sesion = { token: undefined };

export const api = async (request, accion, { params, values } = {}) => {
  const respuesta = await request.fetch(`/api/${accion}`, {
    method: values ? 'POST' : 'GET',
    params,
    data: values,
    headers: { Authorization: `Bearer ${sesion.token}` },
  });
  expect(respuesta.ok(), `${accion}: ${respuesta.status()}`).toBeTruthy();
  return (await respuesta.json()).data;
};

export const iniciarSesionApi = async (request) => {
  const respuesta = await request.post('/api/auth:signIn', {
    data: { account: USUARIO, password: CLAVE },
    headers: { 'X-Authenticator': 'basic' },
  });
  sesion.token = (await respuesta.json()).data.token;
};

export const iniciarSesionUi = async (page) => {
  await page.goto('/signin');
  await page.getByPlaceholder(/usuario|correo|email/i).first().fill(USUARIO);
  await page.getByPlaceholder(/contraseña|password/i).fill(CLAVE);
  await page.getByRole('button', { name: /iniciar|sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin/);
};
