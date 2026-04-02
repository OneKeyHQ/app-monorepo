import type { IEarnBabylonTrackingItem } from '@onekeyhq/shared/types/staking';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityBabylonSync extends SimpleDbEntityBase<
  IEarnBabylonTrackingItem[]
> {
  entityName = 'babylonSync';

  override enableCache = false;

  async getTrackingList() {
    const data = await this.getRawData();
    return data ?? [];
  }

  async addTrackingItem(item: IEarnBabylonTrackingItem) {
    const items = await this.getTrackingList();
    await this.setRawData([...items, item]);
  }

  async removeTrackingItem(item: { txIds: string[] }) {
    const items = await this.getTrackingList();
    const remain = items.filter((o) => !item.txIds.includes(o.txId));
    await this.setRawData([...remain]);
  }
}
