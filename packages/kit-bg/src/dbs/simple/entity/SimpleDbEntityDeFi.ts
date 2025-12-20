import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ENetworkStatus, IServerNetwork } from '@onekeyhq/shared/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IDeFiDBStruct {
  enabledNetworksMap?: Record<string, boolean>; // <networkId, enabled>
}

export class SimpleDbEntityDeFi extends SimpleDbEntityBase<IDeFiDBStruct> {
  entityName = 'deFi';

  override enableCache = false;

  @backgroundMethod()
  async updateEnabledNetworksMap({
    merge,
    enabledNetworksMap = {},
  }: {
    merge?: boolean;
    enabledNetworksMap?: Record<string, boolean>;
  }) {
    await this.setRawData((rawData) => {
      const originalEnabledNetworksMap = rawData?.enabledNetworksMap ?? {};
      const finalEnabledNetworksMap = merge
        ? {
            ...originalEnabledNetworksMap,
            ...enabledNetworksMap,
          }
        : enabledNetworksMap;
      return { enabledNetworksMap: finalEnabledNetworksMap };
    });
  }

  @backgroundMethod()
  async getEnabledNetworksMap(): Promise<Record<string, boolean>> {
    const rawData = await this.getRawData();
    return rawData?.enabledNetworksMap ?? {};
  }
}
