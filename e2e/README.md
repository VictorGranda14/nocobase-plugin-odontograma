# Pruebas E2E

Corren con Playwright contra un NocoBase local que tenga el plugin activado. Requisitos:

1. Las colecciones creadas con `scripts/crear-colecciones.mjs`, con al menos una ficha clínica que tenga paciente.
2. En el catálogo, las prestaciones «Resina» (diente), «Destartraje por cuadrante», «Frenillos arcada» y «Limpieza» (boca), cada una con un color distinto.
3. Una página «Fichas dentales» cuya primera tabla sea de `fichaDental`, con la acción «Ver» y el bloque Odontograma dentro de su popup.

Cada prueba crea por API sus fichas dentales, planes de tratamiento y prestaciones, y los borra al terminar.

Desde la copia del plugin en el proyecto de compilación (para que se resuelva `@playwright/test`):

```bash
npx playwright test --config packages/plugins/@gransalud/plugin-odontograma/e2e/playwright.config.mjs
```

Variables opcionales: `E2E_URL` (por defecto `http://localhost:13001`), `E2E_USER` y `E2E_PASSWORD`.
