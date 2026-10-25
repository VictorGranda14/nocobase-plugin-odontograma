import { Plugin } from '@nocobase/client';
import { BLOCK_KEY } from './constants';
import { OdontogramaBlock } from './OdontogramaBlock';
import { odontogramaInitializerItem, odontogramaSettings, useOdontogramaBlockProps } from './schema';

export class PluginOdontogramaClient extends Plugin {
  async load() {
    this.app.addComponents({ OdontogramaBlock });
    this.app.addScopes({ useOdontogramaBlockProps });
    this.app.schemaSettingsManager.add(odontogramaSettings);
    this.app.schemaInitializerManager.addItem('popup:common:addBlock', `otherBlocks.${BLOCK_KEY}`, odontogramaInitializerItem);
  }
}

export default PluginOdontogramaClient;
