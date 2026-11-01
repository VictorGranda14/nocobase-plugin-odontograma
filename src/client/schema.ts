import { useFieldSchema } from '@formily/react';
import { ISchema, SchemaInitializerItemType, SchemaSettings, useCollection, useDesignable, useSchemaInitializer } from '@nocobase/client';
import {
  BLOCK_KEY,
  BLOCK_NAME,
  BLOCK_SETTINGS_NAME,
  CAMPO_PLAN_NAME,
  CAMPO_PLAN_SETTINGS_NAME,
  CAMPOS_FICHA,
  CAMPOS_LINEA,
  CAMPOS_PLAN,
  COLECCION_FICHA,
  COLECCION_LINEAS,
  COLECCION_PLAN,
} from './constants';

// Las opciones del bloque se guardan en el nodo CardItem (x-decorator-props.odontograma).
export function useOdontogramaBlockProps() {
  const fieldSchema = useFieldSchema();
  return fieldSchema.parent?.['x-decorator-props']?.[BLOCK_KEY] ?? {};
}

export const odontogramaSchema: ISchema = {
  type: 'void',
  'x-component': 'CardItem',
  'x-settings': BLOCK_SETTINGS_NAME,
  'x-decorator-props': {
    [BLOCK_KEY]: { readOnly: false },
  },
  properties: {
    odontograma: {
      type: 'void',
      'x-component': BLOCK_NAME,
      'x-use-component-props': 'useOdontogramaBlockProps',
    },
  },
};

export const odontogramaInitializerItem: SchemaInitializerItemType = {
  type: 'item',
  name: BLOCK_KEY,
  icon: 'MedicineBoxOutlined',
  useComponentProps() {
    const { insert } = useSchemaInitializer();
    return {
      title: 'Odontograma',
      onClick: () => insert(odontogramaSchema),
    };
  },
};

export const odontogramaSettings = new SchemaSettings({
  name: BLOCK_SETTINGS_NAME,
  items: [
    {
      name: 'readOnly',
      type: 'switch',
      useComponentProps() {
        const fieldSchema = useFieldSchema();
        const { deepMerge } = useDesignable();
        const opciones = fieldSchema['x-decorator-props']?.[BLOCK_KEY] ?? {};
        return {
          title: 'Solo lectura',
          checked: !!opciones.readOnly,
          onChange(readOnly: boolean) {
            deepMerge({
              'x-uid': fieldSchema['x-uid'],
              'x-decorator-props': {
                ...fieldSchema['x-decorator-props'],
                [BLOCK_KEY]: { ...opciones, readOnly },
              },
            });
          },
        };
      },
    },
    {
      name: 'divider',
      type: 'divider',
    },
    {
      name: 'remove',
      type: 'remove',
      componentProps: {
        removeParentsIfNoChildren: true,
        breakRemoveOn: { 'x-component': 'Grid' },
      },
    },
  ],
});

// Campo «plan de tratamiento» de la ficha dental, para su subformulario dentro del formulario de la ficha clínica.
// El modo «Nester» y los hijos solo sirven para que NocoBase cargue el plan con sus prestaciones (appends) y los
// grabe anidados al guardar (updateAssociationValues); el campo los dibuja por su cuenta.
export const odontogramaPlanSchema: ISchema = {
  type: 'object',
  name: CAMPOS_FICHA.plan,
  title: 'Plan de tratamiento',
  'x-decorator': 'FormItem',
  'x-component': CAMPO_PLAN_NAME,
  'x-collection-field': `${COLECCION_FICHA}.${CAMPOS_FICHA.plan}`,
  'x-component-props': { mode: 'Nester' },
  'x-toolbar': 'FormItemSchemaToolbar',
  'x-settings': CAMPO_PLAN_SETTINGS_NAME,
  properties: {
    [CAMPOS_PLAN.lineas]: {
      type: 'array',
      'x-collection-field': `${COLECCION_PLAN}.${CAMPOS_PLAN.lineas}`,
      'x-component-props': { mode: 'Nester' },
      properties: {
        [CAMPOS_LINEA.prestacion]: { type: 'object', 'x-collection-field': `${COLECCION_LINEAS}.${CAMPOS_LINEA.prestacion}` },
        [CAMPOS_LINEA.realizacion]: { type: 'object', 'x-collection-field': `${COLECCION_LINEAS}.${CAMPOS_LINEA.realizacion}` },
      },
    },
  },
};

export const odontogramaPlanInitializerItem: SchemaInitializerItemType = {
  type: 'item',
  name: 'odontogramaPlan',
  icon: 'MedicineBoxOutlined',
  useVisible() {
    return useCollection()?.name === COLECCION_FICHA;
  },
  useComponentProps() {
    const { insert } = useSchemaInitializer();
    return {
      title: 'Odontograma (plan de tratamiento)',
      onClick: () => insert(odontogramaPlanSchema),
    };
  },
};

export const odontogramaPlanSettings = new SchemaSettings({
  name: CAMPO_PLAN_SETTINGS_NAME,
  items: [
    {
      name: 'remove',
      type: 'remove',
      componentProps: {
        removeParentsIfNoChildren: true,
        breakRemoveOn: { 'x-component': 'Grid' },
      },
    },
  ],
});
