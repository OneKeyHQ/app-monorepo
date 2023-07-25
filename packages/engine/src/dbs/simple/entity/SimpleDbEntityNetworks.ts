import { OnekeyNetworkUpdatedAt } from '@onekeyhq/shared/src/config/presetNetworks';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { getFiatEndpoint } from '../../../endpoint';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityServerNetworksData = {
  networksMap: Record<string, IServerNetwork>;
  updateTimestampMap: Record<string, number>;
};

const defaultData = {
  networksMap: {},
  updateTimestampMap: {},
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
    const endpoint = getFiatEndpoint();
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
      updateTimestampMap: {
        ...(data.updateTimestampMap ?? {}),
        [endpoint]: Date.now(),
      },
    });
  }

  async getTimestamp() {
    const data = await this.getData();
    const endpoint = getFiatEndpoint();
    return data.updateTimestampMap?.[endpoint] || OnekeyNetworkUpdatedAt;
  }

  async getData(): Promise<ISimpleDbEntityServerNetworksData> {
    return (await this.getRawData()) || defaultData;
  }

  async clear() {
    return this.setRawData(defaultData);
  }
}
