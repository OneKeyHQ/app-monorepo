import { uniqBy } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import type { IAccountDeriveTypes } from '../../../vaults/types';

export interface IAllNetworksDBStruct {
  disabledNetworks: {
    networkId: string;
  }[];
  enabledNetworks: {
    networkId: string;
  }[];
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
    disabledNetworks = [],
    enabledNetworks = [],
  }: {
    disabledNetworks?: {
      networkId: string;
    }[];
    enabledNetworks?: {
      networkId: string;
    }[];
  }): Promise<void> {
    await this.setRawData(({ rawData }) => {
      const originalDisabledNetworks = rawData?.disabledNetworks ?? [];
      const originalEnabledNetworks = rawData?.enabledNetworks ?? [];

      const finalEnabledNetworks = uniqBy(
        [...originalEnabledNetworks, ...enabledNetworks],
        (n) => n.networkId,
      ).filter(
        (n) => !disabledNetworks.find((o) => o.networkId === n.networkId),
      );

      // remove duplicated networks
      const finalDisabledNetworks = uniqBy(
        [...originalDisabledNetworks, ...disabledNetworks],
        (n) => n.networkId,
      ).filter(
        (n) => !enabledNetworks.find((o) => o.networkId === n.networkId),
      );
      return {
        disabledNetworks: finalDisabledNetworks,
        enabledNetworks: finalEnabledNetworks,
      };
    });
  }
}
