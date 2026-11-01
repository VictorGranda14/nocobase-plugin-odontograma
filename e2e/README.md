# Pruebas E2E

Corren con Playwright contra un NocoBase local que tenga el plugin activado. Requisitos:

1. Las colecciones creadas con `scripts/crear-colecciones.mjs`, con al menos una ficha clínica que tenga paciente.
2. En el catálogo, las prestaciones «Resina» (diente), «Destartraje por cuadrante», «Frenillos arcada» y «Limpieza» (boca), cada una con un color distinto.
3. Una página «Fichas dentales» cuya primera tabla sea de `fichaDental`, con la acción «Ver» y el bloque Odontograma dentro de su popup.
4. Para `formulario.e2e.mjs`, una página «Fichas clínicas (E2E)» con una tabla de `fichasClinicas`, «Añadir nuevo» y «Editar» en drawer. Sus formularios deben tener:
   - `tipoFicha`;
   - `pacienteAsociado` (Select con etiqueta `rutPaciente`);
   - `fichasDentalesAsociadas` como subformulario con `fecha`, `observaciones` y el campo «Odontograma (plan de tratamiento)».

Cada prueba borra al terminar, por id, lo que creó: fichas clínicas, fichas dentales, planes y prestaciones.

Desde la copia del plugin en el proyecto de compilación (para que se resuelva `@playwright/test`):

```bash
npx playwright test --config packages/plugins/@gransalud/plugin-odontograma/e2e/playwright.config.mjs
```

Variables opcionales: `E2E_URL` (por defecto `http://localhost:13001`), `E2E_USER` y `E2E_PASSWORD`.
