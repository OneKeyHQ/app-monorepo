import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IAllNetworksDBStruct {
  disabledNetworks: Record<string, boolean>;
  enabledNetworks: Record<string, boolean>;
}

export class SimpleDbEntityAllNetworks extends SimpleDbEntityBase<IAllNetworksDBStruct> {
  entityName = 'allNetworks';

  override enableCache = true;

  @backgroundMethod()
  async getAllNetworksState(): Promise<IAllNetworksDBStruct> {
    const data = await this.getRawData();
    return {
      disabledNetworks: data?.disabledNetworks ?? {},
      enabledNetworks: data?.enabledNetworks ?? {},
    };
  }

  @backgroundMethod()
  async updateAllNetworksState({
    disabledNetworks = {},
    enabledNetworks = {},
  }: {
    disabledNetworks?: Record<string, boolean>;
    enabledNetworks?: Record<string, boolean>;
  }): Promise<void> {
    await this.setRawData(({ rawData }) => {
      const originalDisabledNetworks = rawData?.disabledNetworks ?? {};
      const originalEnabledNetworks = rawData?.enabledNetworks ?? {};

      const finalEnabledNetworks = {
        ...originalEnabledNetworks,
        ...enabledNetworks,
      };

      // delete enabled networks in finalEnabledNetworks which are in disabledNetworks
      for (const networkId in finalEnabledNetworks) {
        if (disabledNetworks[networkId]) {
          delete finalEnabledNetworks[networkId];
        }
      }

      const finalDisabledNetworks = {
        ...originalDisabledNetworks,
        ...disabledNetworks,
      };

      // delete disabled networks in finalDisabledNetworks which are in enabledNetworks
      for (const networkId in finalDisabledNetworks) {
        if (enabledNetworks[networkId]) {
          delete finalDisabledNetworks[networkId];
        }
      }

      return {
        disabledNetworks: finalDisabledNetworks,
        enabledNetworks: finalEnabledNetworks,
      };
    });
  }
}
