# Pruebas E2E

Corren con Playwright contra un NocoBase local que tenga el plugin activado. Requisitos:

1. Las colecciones creadas con `scripts/crear-colecciones.mjs`, con al menos una ficha clínica que tenga paciente.
2. En el catálogo, las prestaciones «Resina» (diente), «Destartraje por sextante», «Frenillos arcada» y «Limpieza» (boca), cada una con un color distinto.
3. Una página «Fichas dentales» cuya primera tabla sea de `fichaDental`, con la acción «Ver» y el bloque Odontograma dentro de su popup.
4. Para las pruebas de `formulario/`, una página «Fichas clínicas (E2E)» con una tabla de `fichasClinicas`, «Añadir nuevo» y «Editar» en drawer. Sus formularios deben tener:
   - `tipoFicha`;
   - `pacienteAsociado` (Select con etiqueta `rutPaciente`);
   - `fichasDentalesAsociadas` como subformulario con `fecha`, `observaciones` y el campo «Odontograma (plan de tratamiento)».

Cada prueba borra al terminar, por id, lo que creó: fichas clínicas, fichas dentales, planes y prestaciones.

Desde la copia del plugin en el proyecto de compilación (para que se resuelva `@playwright/test`):

```bash
npx playwright test --config packages/plugins/@gransalud/plugin-odontograma/e2e/playwright.config.mjs
```

Para correr una carpeta o un archivo, se añade su ruta (relativa a `e2e/`) como filtro:

```bash
npx playwright test --config packages/plugins/@gransalud/plugin-odontograma/e2e/playwright.config.mjs bloque/
npx playwright test --config packages/plugins/@gransalud/plugin-odontograma/e2e/playwright.config.mjs formulario/secciones.e2e.mjs
```

Estructura:

- `apoyo.mjs`: credenciales, `api` y sesión (común a ambas carpetas).
- `bloque/`: bloque Odontograma en el popup «Ver» de una ficha dental. `dibujo`, `zonas`, `caras`, `denticion-temporal`, `planes`, `estados`, `pdf` y `secciones`; su `apoyo.mjs` tiene los helpers y `registrarHooks()`.
- `formulario/`: campo del odontograma en el formulario de la ficha clínica. `crear`, `guardar-cancelar`, `zonas`, `denticion-temporal`, `secciones` y `pdf`; su `apoyo.mjs` tiene los helpers y `registrarHooks()`.

Cada archivo de pruebas llama a `registrarHooks()` (el `beforeEach` de sesión y el `afterEach` de limpieza). El estado que comparten los helpers vive en el objeto `ctx` exportado por el `apoyo.mjs` de cada carpeta. Los módulos de apoyo no terminan en `.e2e.mjs`, así que Playwright no los toma como pruebas.

Variables opcionales: `E2E_URL` (por defecto `http://localhost:13001`), `E2E_USER` y `E2E_PASSWORD`.
