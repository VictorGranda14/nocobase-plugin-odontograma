# @gransalud/plugin-odontograma

Plugin propio de GranSalud: un bloque de NocoBase 1.x para el popup «Ver» de una **ficha dental**. Permite:

- Asociar la atención a un **plan de tratamiento** nuevo o continuar uno anterior del mismo paciente, para seguirlo a lo largo de varias citas.
- Ver un odontograma (FDI, dentición permanente) pintado según las prestaciones del plan.
- Asignar prestaciones del catálogo a un **diente**, un **cuadrante**, una **arcada** o la **boca completa**, con precio editable.
- Marcar cada prestación como planificada o realizada (se registra la atención en que se realizó), y ver los totales.
- Descargar el **presupuesto en PDF** (paciente, profesional, odontograma, detalle y totales).

El plugin no tiene lógica de servidor: lee y escribe colecciones normales con la API de NocoBase, así que se aplican los permisos de cada rol.

El dibujo viene del paquete propio [`@gransalud/odontograma-react`](https://github.com/VictorGranda14/odontograma-react) (dientes de perfil y círculo de 5 caras). Los dientes se basan en la ilustración «The chart of human teeth» de [Vecteezy.com](https://www.vecteezy.com). También se incluyen `jspdf` 4.2.1 y `jspdf-autotable` 5.0.9 (MIT); jsPDF solo se descarga al generar un PDF.

## Colecciones

Deben existir antes de usar el bloque. `scripts/crear-colecciones.mjs` las crea por API con las mismas definiciones que la interfaz y omite las que ya existan:

```bash
NOCOBASE_URL=https://<instancia> NOCOBASE_EMAIL=<admin> NOCOBASE_PASSWORD=<clave> node scripts/crear-colecciones.mjs
```

| Colección | Campos |
|---|---|
| `prestacionesDentales` (catálogo) | `nombrePrestacion`, `alcance` (`diente`/`cuadrante`/`arcada`/`boca`), `precio` (CLP), `color`, `activo` |
| `planesTratamiento` (plan) | `pacienteAsociado` → `paciente` (`FK_paciente`; inversa `planesTratamientoAsociados`) |
| `fichaDental` (atención) | `fecha`, `observaciones`, `fichaClinicaAsociada` → `fichasClinicas` (`FK_fichaClinica`; inversa `fichasDentalesAsociadas`), `planTratamientoAsociado` → `planesTratamiento` (`FK_planTratamiento`; inversa `fichasDentalesAsociadas`) |
| `prestacionesPlanTratamiento` (líneas) | `planTratamientoAsociado` → `planesTratamiento` (`FK_planTratamiento`; inversa `prestacionesAsociadas`), `fichaDentalRealizacion` → `fichaDental` (`FK_fichaDentalRealizacion`; inversa `prestacionesRealizadas`), `prestacionAsociada` → `prestacionesDentales` (`FK_prestacion`), `zona`, `precio`, `estado` (`planificado`/`realizado`), `notas` |

Cada ficha dental (una atención) apunta a un plan, y un plan se comparte entre las atenciones de un mismo paciente. Las prestaciones pertenecen al plan; `fichaDentalRealizacion` guarda en qué atención se marcó como realizada.

`zona` vale `11`…`48` (diente), `C1`…`C4` (cuadrante), `AS`/`AI` (arcada) o `BOCA`. El precio de cada línea es una copia del catálogo al agregarla, así que cambiar el catálogo no altera presupuestos ya hechos.

Los nombres de colecciones y campos están centralizados en `src/client/constants.ts`.

## Compilar

En un proyecto creado con `npx create-nocobase-app@<versión exacta de NocoBase del entorno>`:

1. Compilar `odontograma-react` (`npm run build`) y copiar su `dist/` y su `package.json` (sin `devDependencies` ni `scripts`) a `packages/libs/odontograma-react`.
2. Copiar este repositorio a `packages/plugins/@gransalud/plugin-odontograma` y ejecutar `yarn install`.
3. Ejecutar `yarn build @gransalud/plugin-odontograma --tar --no-dts`.
4. El paquete queda en `storage/tar/@gransalud/plugin-odontograma-<versión>.tgz`.

## Instalar en NocoBase

Es un plugin propio: no está publicado en npm ni en el marketplace de NocoBase, así que se instala desde el `.tgz` compilado.

1. En el gestor de plugins, *Añadir y actualizar → Subir plugin* y elegir el `.tgz`. También se puede descomprimir en `storage/plugins/@gransalud/plugin-odontograma/` de la instancia y reiniciar NocoBase.
2. Activar «Odontograma» en el gestor de plugins.

## Uso

1. En el popup «Ver» de una ficha dental, entrar en el editor de UI.
2. Ir a *Añadir bloque → Otros bloques → Odontograma*.
3. En los ajustes del bloque se puede activar **Solo lectura**: oculta agregar, eliminar y el cambio de estado, pero deja consultar dientes y descargar el PDF.

Si la ficha dental aún no tiene plan, el bloque ofrece **Crear plan nuevo** o **Continuar plan** (lista los planes del paciente con su fecha de inicio y cantidad de prestaciones). En solo lectura solo avisa que no hay plan.

## Limitaciones

- Solo dientes permanentes y diente completo (caras y dientes temporales: issues #2 y #5).
- Cada diente muestra un solo color: el de la zona más específica (diente > cuadrante > arcada). El tooltip y la tabla muestran todas las prestaciones que lo afectan.
- La imagen del PDF no incluye la leyenda de colores; la tabla del presupuesto detalla cada línea.
- El plan de una atención no se cambia desde el bloque una vez elegido; se puede editar el campo «Plan de Tratamiento» con los formularios normales de NocoBase.
