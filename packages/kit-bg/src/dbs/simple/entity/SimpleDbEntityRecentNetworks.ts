import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IRecentNetworksDBStruct {
  recentNetworks: Record<
    string,
    {
      updatedAt: number;
    }
  >;
}

export class SimpleDbEntityRecentNetworks extends SimpleDbEntityBase<IRecentNetworksDBStruct> {
  entityName = 'recentNetworks';

  override enableCache = false;

  @backgroundMethod()
  async getRecentNetworksMap() {
    const rawData = await this.getRawData();
    return rawData?.recentNetworks ?? {};
  }

  @backgroundMethod()
  async clearRecentNetworks() {
    await this.setRawData({ recentNetworks: {} });
  }

  @backgroundMethod()
  async deleteRecentNetwork({ networkId }: { networkId: string }) {
    await this.setRawData((rawData) => {
      const recentNetworks = rawData?.recentNetworks ?? {};
      delete recentNetworks[networkId];
      return { recentNetworks };
    });
  }

  @backgroundMethod()
  async getRecentNetworks({
    limit = 5,
    availableNetworks,
  }: {
    limit?: number;
    availableNetworks?: IServerNetwork[];
  } = {}) {
    const rawData = await this.getRawData();
    const recentNetworks = rawData?.recentNetworks ?? {};

    const recentNetworksSorted = Object.entries(recentNetworks).sort(
      ([, { updatedAt: timestampA }], [, { updatedAt: timestampB }]) =>
        Number(timestampB) - Number(timestampA),
    );

    if (availableNetworks && availableNetworks.length > 0) {
      const availableNetworksMap = new Map(
        availableNetworks.map((network) => [network.id, network]),
      );

      const recentNetworksTemp = [];

      for (const [networkId] of recentNetworksSorted) {
        if (availableNetworksMap.has(networkId)) {
          recentNetworksTemp.push(networkId);
        }
        if (recentNetworksTemp.length >= limit) {
          return recentNetworksTemp;
        }
      }

      return recentNetworksTemp;
    }

    return recentNetworksSorted.slice(0, limit).map(([networkId]) => networkId);
  }

  @backgroundMethod()
  async updateRecentNetworks(
    data: Record<
      string,
      {
        updatedAt: number;
      }
    >,
  ) {
    await this.setRawData((rawData) => {
      const recentNetworks = rawData?.recentNetworks ?? {};
      Object.entries(data).forEach(([networkId, { updatedAt }]) => {
        recentNetworks[networkId] = {
          ...recentNetworks[networkId],
          updatedAt,
        };
      });
      return { recentNetworks };
    });
  }
}
