import type { IServerNetwork } from '@onekeyhq/shared/types';

import { V4SimpleDbEntityBase } from '../V4SimpleDbEntityBase';

export type IV4SimpleDbEntityServerNetworksData = {
  networksMap: Record<string, IServerNetwork>;
  updateTimestampMap: Record<string, number>;
};

const defaultData = {
  networksMap: {},
  updateTimestampMap: {},
};

export class V4SimpleDbEntityServerNetworks extends V4SimpleDbEntityBase<IV4SimpleDbEntityServerNetworksData> {
  entityName = 'serverNetworks';

  override enableCache = false;

  async getServerNetworks() {
    const data = await this.getData();
    if (!data) {
      return [];
    }
    return Object.values(data.networksMap);
  }

  async getData(): Promise<IV4SimpleDbEntityServerNetworksData> {
    return (await this.getRawData()) || defaultData;
  }
}
