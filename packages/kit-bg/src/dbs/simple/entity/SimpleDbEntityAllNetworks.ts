import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IAllNetworksDBStruct {
  enabledNetworks: string[];
}

export class SimpleDbEntityCustomRpc extends SimpleDbEntityBase<IAllNetworksDBStruct> {
  entityName = 'customRpc';

  override enableCache = false;

  @backgroundMethod()
  async getEnabledNetworks(): Promise<string[]> {
    const data = await this.getRawData();
    return data?.enabledNetworks ?? [];
  }

  @backgroundMethod()
  async setEnabledNetworks(enabledNetworks: string[]): Promise<void> {
    await this.setRawData({ enabledNetworks });
  }
}
