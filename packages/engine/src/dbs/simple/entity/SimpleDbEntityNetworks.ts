import { OnekeyNetworkUpdatedAt } from '@onekeyhq/shared/src/config/presetNetworks';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityServerNetworksData = {
  networksMap: Record<string, IServerNetwork>;
  updateTimestamp: number;
};

const defaultData = {
  networksMap: {},
  updateTimestamp: 0,
};

export class SimpleDbEntityServerNetworks extends SimpleDbEntityBase<ISimpleDbEntityServerNetworksData> {
  entityName = 'serverNetworks';

  override enableCache = true;

  async getServerNetworks() {
    const data = await this.getData();
    if (!data) {
      return [];
    }
    return Object.values(data.networksMap);
  }

  async updateNetworks(networks: IServerNetwork[]) {
    const data = await this.getData();
    this.setRawData({
      ...data,
      networksMap: {
        ...data.networksMap,
        ...networks.reduce((memo, next) => {
          memo[next.id] = next;
          return memo;
        }, {} as ISimpleDbEntityServerNetworksData['networksMap']),
      },
      updateTimestamp: Date.now(),
    });
  }

  async getTimestamp() {
    const data = await this.getData();
    return data.updateTimestamp || OnekeyNetworkUpdatedAt;
  }

  async getData(): Promise<ISimpleDbEntityServerNetworksData> {
    return (await this.getRawData()) || defaultData;
  }

  async clear() {
    return this.setRawData(defaultData);
  }
}
