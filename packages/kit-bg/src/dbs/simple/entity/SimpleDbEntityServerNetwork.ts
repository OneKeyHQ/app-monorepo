import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ENetworkStatus, IServerNetwork } from '@onekeyhq/shared/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IServerNetworkDBStruct {
  data: Record<
    string,
    IServerNetwork & { createdAt: number; updatedAt: number }
  >;
  lastFetchTime: number; // last fetch api time
}

export class SimpleDbEntityServerNetwork extends SimpleDbEntityBase<IServerNetworkDBStruct> {
  entityName = 'ServerNetwork';

  override enableCache = false;

  @backgroundMethod()
  async upsertServerNetworks(params: { networkInfos: IServerNetwork[] }) {
    const { networkInfos } = params;
    await this.setRawData(({ rawData }) => {
      const now = Date.now();
      const data: IServerNetworkDBStruct = {
        data: {},
        lastFetchTime: now,
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
  }> {
    const rawData = await this.getRawData();
    const result = Object.values(rawData?.data || {}).sort(
      (a, b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0),
    );
    return {
      networks: result,
      lastFetchTime: rawData?.lastFetchTime,
    };
  }

  @backgroundMethod()
  async getServerNetwork(params: { networkId: string }) {
    const { networkId } = params;
    const rawData = await this.getRawData();
    return rawData?.data?.[networkId];
  }
}
