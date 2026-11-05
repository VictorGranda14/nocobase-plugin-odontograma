# @gransalud/plugin-odontograma

Plugin propio de GranSalud para NocoBase 1.x. Agrega un odontograma en dos lugares: un bloque para el popup «Ver» de una **ficha dental**, y un campo para el subformulario de la ficha dental dentro del formulario de crear o editar una **ficha clínica**. Permite:

- Asociar la atención a un **plan de tratamiento** nuevo o continuar uno anterior del mismo paciente, para seguirlo a lo largo de varias citas.
- Ver un odontograma (FDI) pintado según las prestaciones del plan, con pestañas para la dentición **permanente** y la **temporal**.
- Asignar prestaciones del catálogo a un **diente**, un **sextante**, una **arcada** o la **boca completa**, con precio editable. Se eligen en el dibujo, con dos filas de selectores bajo los dientes. Una prestación de diente también puede ir a una o varias de sus **caras**.
- **Mostrar u ocultar el dibujo** de cada plan. Oculto, las zonas se eligen en una lista y el PDF sale sin odontograma.
- Marcar cada prestación como planificada o realizada (se registra la atención en que se realizó), y ver los totales.
- Ordenar el plan en **secciones** con nombre (por ejemplo, etapas), cada una con su subtotal. Se pueden renombrar o eliminar desde su menú; eliminar una sección elimina sus prestaciones.
- Descargar el **presupuesto en PDF** (paciente, profesional, odontograma, detalle y totales), con las caras de cada línea. Incluye un odontograma por cada dentición con prestaciones por diente; las de sextante, arcada y boca no cuentan, y si no hay ninguna sale el permanente.

Lee y escribe colecciones normales con la API de NocoBase, así que se aplican los permisos de cada rol.

- **Bloque:** guarda cada cambio al instante.
- **Campo del formulario:** no graba nada hasta pulsar «Enviar». Entonces NocoBase guarda en una sola petición la ficha clínica, la ficha dental, el plan y sus prestaciones.

La única lógica de servidor completa ese guardado. Al guardar una ficha clínica:

- las prestaciones marcadas como realizadas que aún no tienen atención quedan registradas en su ficha dental;
- se eliminan las prestaciones que quedaron sin plan.

El dibujo viene del paquete propio [`@gransalud/odontograma-react`](https://github.com/VictorGranda14/odontograma-react) (dientes de perfil y círculo de 5 caras). Los dientes se basan en la ilustración «The chart of human teeth» de [Vecteezy.com](https://www.vecteezy.com). También se incluyen `jspdf` 4.2.1 y `jspdf-autotable` 5.0.9 (MIT); jsPDF solo se descarga al generar un PDF.

## Colecciones

Deben existir antes de usar el bloque. `scripts/crear-colecciones.mjs` las crea por API con las mismas definiciones que la interfaz. En las que ya existan, solo agrega los campos que falten, agrega las opciones nuevas de los campos de selección y quita las retiradas (los cuadrantes). Lee las variables de un archivo `.env` si existe; las del entorno tienen prioridad:

```bash
NOCOBASE_URL=https://<instancia> NOCOBASE_EMAIL=<admin> NOCOBASE_PASSWORD=<clave> node scripts/crear-colecciones.mjs
```

| Colección | Campos |
|---|---|
| `prestacionesDentales` (catálogo) | `nombrePrestacion`, `alcance` (`diente`/`sextante`/`arcada`/`boca`), `precio` (CLP), `color`, `activo` |
| `planesTratamiento` (plan) | `pacienteAsociado` → `paciente` (`FK_paciente`; inversa `planesTratamientoAsociados`), `mostrarOdontograma` |
| `fichaDental` (atención) | `fecha`, `observaciones`, `fichaClinicaAsociada` → `fichasClinicas` (`FK_fichaClinica`; inversa `fichasDentalesAsociadas`), `planTratamientoAsociado` → `planesTratamiento` (`FK_planTratamiento`; inversa `fichasDentalesAsociadas`) |
| `prestacionesPlanTratamiento` (líneas) | `planTratamientoAsociado` → `planesTratamiento` (`FK_planTratamiento`; inversa `prestacionesAsociadas`), `fichaDentalRealizacion` → `fichaDental` (`FK_fichaDentalRealizacion`; inversa `prestacionesRealizadas`), `prestacionAsociada` → `prestacionesDentales` (`FK_prestacion`), `zona`, `caras`, `precio`, `estado` (`planificado`/`realizado`), `seccion`, `notas` |

Cada ficha dental (una atención) apunta a un plan, y un plan se comparte entre las atenciones de un mismo paciente. Las prestaciones pertenecen al plan; `fichaDentalRealizacion` guarda en qué atención se marcó como realizada.

`seccion` es un texto libre: una sección existe mientras tenga prestaciones, y las prestaciones sin sección se muestran en «Sin sección». Las secciones aparecen en orden de creación, en la pantalla y en el PDF.

`zona` vale `11`…`48` (diente permanente), `51`…`85` (diente temporal), `S1`…`S6` (sextante), `AS`/`AI` (arcada) o `BOCA`. El precio de cada línea es una copia del catálogo al agregarla, así que cambiar el catálogo no altera presupuestos ya hechos.

`caras` guarda las caras de una línea de diente, separadas por coma (`Mesial,Oclusal`). Si está vacío, la línea es del diente completo.

`mostrarOdontograma` guarda si el plan muestra el dibujo. Si está vacío, lo muestra.

Cada sextante incluye sus dientes permanentes y temporales: S1 18–14 y 55–54, S2 13–23 y 53–63, S3 24–28 y 64–65, S4 38–34 y 75–74, S5 33–43 y 73–83, S6 44–48 y 84–85.

Los nombres de colecciones y campos están centralizados en `src/client/constants.ts`.

## Compilar

En un proyecto creado con `npx create-nocobase-app@<versión exacta de NocoBase del entorno>`:

1. Compilar `odontograma-react` (`npm run build`) y copiar su `dist/` y su `package.json` (sin `devDependencies` ni `scripts`) a `packages/libs/odontograma-react`.
2. Copiar este repositorio a `packages/plugins/@gransalud/plugin-odontograma` y ejecutar `yarn install`.
3. Ejecutar `yarn build @gransalud/plugin-odontograma --tar --no-dts`.
4. El paquete queda en `storage/tar/@gransalud/plugin-odontograma-<versión>.tgz`.

## Instalar en NocoBase

Es un plugin propio: no está publicado en npm ni en el marketplace de NocoBase, así que se instala desde el `.tgz` compilado.

Al actualizarlo, se debe correr `scripts/crear-colecciones.mjs` **antes** de subir el `.tgz`: si falta un campo nuevo, como `caras`, sus datos no se guardarían aunque la pantalla no lo avise.

1. En el gestor de plugins, *Añadir y actualizar → Subir plugin* y elegir el `.tgz`. También se puede descomprimir en `storage/plugins/@gransalud/plugin-odontograma/` de la instancia y reiniciar NocoBase.
2. Activar «Odontograma» en el gestor de plugins.

## Uso

### Agregar una prestación

El selector de prestación se abre en dos columnas: a la izquierda, los alcances con prestaciones activas; a la derecha, las prestaciones del alcance marcado. El alcance se marca con un clic. Al abrir queda marcado el de la última prestación elegida.

Al escribir, el selector busca por nombre en todo el catálogo y muestra el alcance y el precio de cada resultado, que se puede elegir con el mouse o con las flechas y Enter.

La zona de la prestación depende de su alcance en el catálogo:

- **Diente, sextante o arcada:** se toma de lo seleccionado en el dibujo. En un diente, cada clic en una cara del círculo la marca o la desmarca, y la prestación se registra en una sola línea con las caras marcadas (por ejemplo, «Diente 16 · Mesial · Oclusal»), con un precio y un estado. Sin caras marcadas, queda en el diente completo. El clic en el dibujo de perfil vuelve al diente completo. Si no corresponde, «Agregar» queda deshabilitado y un aviso indica qué seleccionar.
- **Boca completa:** se agrega con cualquier selección, o sin ninguna.

El interruptor «Filtrar solo lo que afecta a la selección» deja en la tabla lo que abarca la zona: con un diente, sus prestaciones y las de su sextante, su arcada y la boca; con un sextante o una arcada, las de esa zona y la boca; con la boca, solo las de la boca. El dibujo no se filtra.

### Mostrar u ocultar el odontograma

El interruptor «Mostrar odontograma» es de cada plan, así que vale para todas sus atenciones. El bloque guarda el cambio al instante, y el campo del formulario, al pulsar «Enviar». En solo lectura se ve bloqueado con lo guardado.

Con el dibujo oculto:

- No se muestran el dibujo, sus pestañas, el título de la selección ni el filtro, y la tabla muestra todas las prestaciones sin resaltar ninguna.
- Al elegir una prestación por diente, por sextante o por arcada, aparece una lista con buscador con las zonas de ese alcance. Los dientes se buscan por número o por tipo, y al elegir uno se pueden marcar sus caras. Las prestaciones de boca completa no necesitan elegir zona.
- El presupuesto en PDF sale sin odontograma.

### Bloque en el popup «Ver»

1. En el popup «Ver» de una ficha dental, entrar en el editor de UI.
2. Ir a *Añadir bloque → Otros bloques → Odontograma*.
3. En los ajustes del bloque se puede activar **Solo lectura**: oculta agregar, eliminar y el cambio de estado, pero deja consultar dientes y zonas, y descargar el PDF.

Si la ficha dental aún no tiene plan, el bloque ofrece **Crear plan nuevo** o **Continuar plan**. «Continuar plan» lista los planes del paciente con su fecha de inicio y su cantidad de prestaciones. En solo lectura, el bloque solo avisa que no hay plan.

### Campo en el formulario de la ficha clínica

1. En el formulario de crear o editar `fichasClinicas`, el campo `fichasDentalesAsociadas` debe mostrarse como *Subformulario*, como las fichas de las otras especialidades.
2. Dentro del subformulario, ir a *Configurar campos → Odontograma (plan de tratamiento)*.

El paciente se toma del campo `pacienteAsociado` (o `FK_paciente`) de la ficha clínica. Mientras no se elija paciente, el campo lo pide antes de crear o continuar un plan.

El campo también descarga el presupuesto en PDF, aun antes de guardar. Usa el paciente y el profesional de la ficha clínica, y la fecha y las observaciones de la ficha dental.

## Limitaciones

- El dibujo de perfil de cada diente muestra un solo color: el de su última prestación propia. En cada cara del círculo gana la última línea que la afecta, sea por cara o del diente completo. Los sextantes, las arcadas y la boca no pintan dientes, sino su selector, con el color de su última prestación. El tooltip muestra todas las prestaciones de esa zona, y el de un diente también las de sextante, arcada y boca que lo afectan.
- En el PDF, la imagen no indica qué prestación corresponde a cada color; la tabla del presupuesto detalla cada línea. En pantalla, cada prestación tiene una etiqueta de su color en la tabla.
- Los cuadrantes ya no existen: una prestación del catálogo con ese alcance no se ofrece, y una línea antigua se muestra con su valor (`C1`) sin afectar a ningún diente. Se deben borrar o editar a mano.
- El plan de una atención no se cambia desde el bloque ni desde el campo una vez elegido.
