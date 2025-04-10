import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

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
  async getRecentNetworks({
    limit = 5,
  }: {
    limit?: number;
  } = {}) {
    const rawData = await this.getRawData();
    const recentNetworks = rawData?.recentNetworks ?? {};

    return Object.entries(recentNetworks)
      .sort(
        ([, { updatedAt: timestampA }], [, { updatedAt: timestampB }]) =>
          Number(timestampB) - Number(timestampA),
      )
      .slice(0, limit)
      .map(([networkId]) => networkId);
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
