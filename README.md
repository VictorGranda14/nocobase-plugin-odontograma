# @gransalud/plugin-odontograma

Bloque de NocoBase 1.x para el popup «Ver» de una **ficha dental**. Permite:

- Ver un odontograma (FDI, dentición permanente) pintado según las prestaciones asignadas.
- Asignar prestaciones del catálogo a un **diente**, un **cuadrante**, una **arcada** o la **boca completa**, con precio editable.
- Marcar cada prestación como planificada o realizada, y ver los totales.
- Descargar el **presupuesto en PDF** (paciente, profesional, odontograma, detalle y totales).

El plugin no tiene lógica de servidor: lee y escribe colecciones normales con la API de NocoBase, así que se aplican los permisos de cada rol.

Librerías incluidas en el paquete: [`react-odontogram`](https://github.com/biomathcode/react-odontogram) 0.6.0, `jspdf` 4.2.1 y `jspdf-autotable` 5.0.9, todas MIT. jsPDF solo se descarga al generar un PDF.

## Colecciones

Deben existir antes de usar el bloque. `scripts/crear-colecciones.mjs` las crea por API con las mismas definiciones que la interfaz y omite las que ya existan:

```bash
NOCOBASE_URL=https://<instancia> NOCOBASE_EMAIL=<admin> NOCOBASE_PASSWORD=<clave> node scripts/crear-colecciones.mjs
```

| Colección | Campos |
|---|---|
| `prestacionesDentales` (catálogo) | `nombrePrestacion`, `alcance` (`diente`/`cuadrante`/`arcada`/`boca`), `precio` (CLP), `color`, `activo` |
| `fichaDental` (atención) | `fecha`, `observaciones`, `fichaClinicaAsociada` → `fichasClinicas` (`FK_fichaClinica`; inversa `fichasDentalesAsociadas`) |
| `prestacionesFichaDental` (líneas) | `fichaDentalAsociada` → `fichaDental` (`FK_fichaDental`; inversa `prestacionesAsociadas`), `prestacionAsociada` → `prestacionesDentales` (`FK_prestacion`), `zona`, `precio`, `estado` (`planificado`/`realizado`), `notas` |

`zona` vale `11`…`48` (diente), `C1`…`C4` (cuadrante), `AS`/`AI` (arcada) o `BOCA`. El precio de cada línea es una copia del catálogo al agregarla, así que cambiar el catálogo no altera presupuestos ya hechos.

Los nombres de colecciones y campos están centralizados en `src/client/constants.ts`.

## Compilar

En un proyecto creado con `npx create-nocobase-app@<versión exacta de NocoBase del entorno>`:

1. Copiar este repositorio a `packages/plugins/@gransalud/plugin-odontograma` y ejecutar `yarn install`.
2. Ejecutar `yarn build @gransalud/plugin-odontograma --tar --no-dts`.
3. El paquete queda en `storage/tar/@gransalud/plugin-odontograma-<versión>.tgz`.

## Instalar en Railway (GRANDASALUDV1)

1. Descomprimir el `.tgz` en `storage/plugins/@gransalud/plugin-odontograma/` de la rama del entorno. El Dockerfile ya copia `storage/plugins`.
2. Hacer push y esperar el redeploy.
3. Activar «Odontograma» en el gestor de plugins. La activación queda guardada en la base de datos.

## Uso

1. En el popup «Ver» de una ficha dental, entrar en el editor de UI.
2. Ir a *Añadir bloque → Otros bloques → Odontograma*.
3. En los ajustes del bloque se puede activar **Solo lectura**: oculta agregar, eliminar y el cambio de estado, pero deja consultar dientes y descargar el PDF.

## Limitaciones

- Solo dientes permanentes y diente completo; no hay dientes de leche ni caras del diente.
- Cada diente muestra un solo color: el de la zona más específica (diente > cuadrante > arcada). El tooltip y la tabla muestran todas las prestaciones que lo afectan.
- La imagen del PDF no incluye la leyenda de colores; la tabla del presupuesto detalla cada línea.
