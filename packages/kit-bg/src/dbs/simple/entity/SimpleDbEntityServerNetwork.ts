import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import type { ILocalWalletRemoteConfig } from '../../../vaults/localWallet/remoteConfig';

export interface IServerNetworkDBStruct {
  data: Record<
    string,
    IServerNetwork & { createdAt: number; updatedAt: number }
  >;
  lastFetchTime: number; // last fetch api time
  // Preset network ids the server list marks TRASH.
  delistedPresetNetworkIds?: string[];
  // Validated `extensions.localWallet` settings of preset entries, by network id.
  localWalletConfigs?: Record<string, ILocalWalletRemoteConfig>;
}

export class SimpleDbEntityServerNetwork extends SimpleDbEntityBase<IServerNetworkDBStruct> {
  entityName = 'ServerNetwork';

  override enableCache = false;

  @backgroundMethod()
  async upsertServerNetworks(params: {
    networkInfos: IServerNetwork[];
    delistedPresetNetworkIds?: string[];
    localWalletConfigs?: Record<string, ILocalWalletRemoteConfig>;
  }) {
    const { networkInfos } = params;
    await this.setRawData((rawData) => {
      const now = Date.now();
      const data: IServerNetworkDBStruct = {
        data: {},
        lastFetchTime: now,
        delistedPresetNetworkIds:
          params.delistedPresetNetworkIds ?? rawData?.delistedPresetNetworkIds,
        localWalletConfigs:
          params.localWalletConfigs ?? rawData?.localWalletConfigs,
      };

      // Update or add new network data
      for (const networkInfo of networkInfos) {
        const existingNetwork = rawData?.data?.[networkInfo.id];
        data.data[networkInfo.id] = {
          ...networkInfo,
          createdAt: existingNetwork?.createdAt || now,
          updatedAt: now,
        };
      }

      return data;
    });
  }

  @backgroundMethod()
  async getAllServerNetworks(): Promise<{
    networks: IServerNetwork[];
    lastFetchTime: number | undefined;
    delistedPresetNetworkIds: string[];
    localWalletConfigs: Record<string, ILocalWalletRemoteConfig>;
  }> {
    const rawData = await this.getRawData();
    const result = Object.values(rawData?.data || {}).toSorted(
      (a, b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0),
    );
    return {
      networks: result,
      lastFetchTime: rawData?.lastFetchTime,
      delistedPresetNetworkIds: rawData?.delistedPresetNetworkIds ?? [],
      localWalletConfigs: rawData?.localWalletConfigs ?? {},
    };
  }

  @backgroundMethod()
  async getServerNetwork(params: { networkId: string }) {
    const { networkId } = params;
    const rawData = await this.getRawData();
    return rawData?.data?.[networkId];
  }
}
