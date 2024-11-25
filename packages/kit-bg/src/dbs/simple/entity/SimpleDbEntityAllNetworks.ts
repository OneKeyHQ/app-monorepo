import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IAllNetworksDBStruct {
  disabledNetworks: Record<string, boolean>;
  enabledNetworks: Record<string, boolean>;
}

const removeConflictingNetworks = (
  networks: Record<string, boolean>,
  conflictingNetworks: Record<string, boolean>,
): Record<string, boolean> => {
  const result = { ...networks };
  for (const networkId in result) {
    if (conflictingNetworks[networkId]) {
      delete result[networkId];
    }
  }
  return result;
};

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
    await this.setRawData((rawData) => {
      const originalDisabledNetworks = rawData?.disabledNetworks ?? {};
      const originalEnabledNetworks = rawData?.enabledNetworks ?? {};

      const mergedEnabled = {
        ...originalEnabledNetworks,
        ...enabledNetworks,
      };
      const mergedDisabled = {
        ...originalDisabledNetworks,
        ...disabledNetworks,
      };

      const finalEnabledNetworks = removeConflictingNetworks(
        mergedEnabled,
        disabledNetworks,
      );
      const finalDisabledNetworks = removeConflictingNetworks(
        mergedDisabled,
        enabledNetworks,
      );

      return {
        disabledNetworks: finalDisabledNetworks,
        enabledNetworks: finalEnabledNetworks,
      };
    });
  }
}
