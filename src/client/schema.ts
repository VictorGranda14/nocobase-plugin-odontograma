import { useFieldSchema } from '@formily/react';
import { ISchema, SchemaInitializerItemType, SchemaSettings, useDesignable, useSchemaInitializer } from '@nocobase/client';
import { BLOCK_KEY, BLOCK_NAME, BLOCK_SETTINGS_NAME } from './constants';

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
