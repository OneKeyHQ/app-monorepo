import { uniq } from 'lodash';
import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IAllNetworksDBStruct {
  disabledNetworks: string[]; // network ids
  enabledNetworks: string[]; // network ids
}

export class SimpleDbEntityAllNetworks extends SimpleDbEntityBase<IAllNetworksDBStruct> {
  entityName = 'allNetworks';

  override enableCache = false;

  @backgroundMethod()
  async getAllNetworksState(): Promise<IAllNetworksDBStruct> {
    const data = await this.getRawData();
    return {
      disabledNetworks: data?.disabledNetworks ?? [],
      enabledNetworks: data?.enabledNetworks ?? [],
    };
  }

  @backgroundMethod()
  async updateAllNetworksState({
    disabledNetworks,
    enabledNetworks,
  }: {
    disabledNetworks: string[];
    enabledNetworks: string[];
  }): Promise<void> {
    await this.setRawData(({ rawData }) => {
      const originalDisabledNetworks = rawData?.disabledNetworks ?? [];
      const originalEnabledNetworks = rawData?.enabledNetworks ?? [];

      const finalEnabledNetworks = uniq([
        ...originalEnabledNetworks,
        ...enabledNetworks,
      ]).filter((networkId) => !disabledNetworks.includes(networkId));

      // remove duplicated networks
      const finalDisabledNetworks = uniq([
        ...originalDisabledNetworks,
        ...disabledNetworks,
      ]).filter((networkId) => !enabledNetworks.includes(networkId));

      return {
        disabledNetworks: finalDisabledNetworks,
        enabledNetworks: finalEnabledNetworks,
      };
    });
  }
}
