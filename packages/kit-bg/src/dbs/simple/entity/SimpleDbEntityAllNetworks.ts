import { uniq, uniqBy } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import type { IAccountDeriveTypes } from '../../../vaults/types';

export interface IAllNetworksDBStruct {
  disabledNetworks: {
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }[];
  enabledNetworks: {
    networkId: string;
    deriveType: IAccountDeriveTypes;
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
      deriveType: IAccountDeriveTypes;
    }[];
    enabledNetworks?: {
      networkId: string;
      deriveType: IAccountDeriveTypes;
    }[];
  }): Promise<void> {
    await this.setRawData(({ rawData }) => {
      const originalDisabledNetworks = rawData?.disabledNetworks ?? [];
      const originalEnabledNetworks = rawData?.enabledNetworks ?? [];

      const finalEnabledNetworks = uniqBy(
        [...originalEnabledNetworks, ...enabledNetworks],
        (n) => `${n.networkId}_${n.deriveType}`,
      ).filter(
        (n) =>
          !disabledNetworks.find(
            (o) => o.networkId === n.networkId && o.deriveType === n.deriveType,
          ),
      );

      // remove duplicated networks
      const finalDisabledNetworks = uniqBy(
        [...originalDisabledNetworks, ...disabledNetworks],
        (n) => `${n.networkId}_${n.deriveType}`,
      ).filter(
        (n) =>
          !enabledNetworks.find(
            (o) => o.networkId === n.networkId && o.deriveType === n.deriveType,
          ),
      );
      return {
        disabledNetworks: finalDisabledNetworks,
        enabledNetworks: finalEnabledNetworks,
      };
    });
  }
}
