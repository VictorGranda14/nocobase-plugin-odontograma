import { Plugin } from '@nocobase/client';
import { BLOCK_KEY } from './constants';
import { OdontogramaBlock } from './OdontogramaBlock';
import { OdontogramaPlanField } from './OdontogramaPlanField';
import {
  odontogramaInitializerItem,
  odontogramaPlanInitializerItem,
  odontogramaPlanSettings,
  odontogramaSettings,
  useOdontogramaBlockProps,
} from './schema';

export class PluginOdontogramaClient extends Plugin {
  async load() {
    this.app.addComponents({ OdontogramaBlock, OdontogramaPlanField });
    this.app.addScopes({ useOdontogramaBlockProps });
    this.app.schemaSettingsManager.add(odontogramaSettings, odontogramaPlanSettings);
    this.app.schemaInitializerManager.addItem('popup:common:addBlock', `otherBlocks.${BLOCK_KEY}`, odontogramaInitializerItem);
    this.app.schemaInitializerManager.addItem('form:configureFields', 'odontogramaPlan', odontogramaPlanInitializerItem);
  }
}

export default PluginOdontogramaClient;
