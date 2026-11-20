import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IChainResourceDBStruct {
  tronClaimResourceInfo?: Record<
    string,
    {
      lastClaimTime: number;
    }
  >;
  // unsignedTx uuid → an energy rental order placed for that tx (OK-67168).
  // A retry of the tx reads it to tell a rental already paid for from one
  // that was never ordered, which the broadcast record alone cannot say.
  tronRentalOrders?: Record<
    string,
    {
      orderedAt: number;
    }
  >;
}

// A retry can only come from a UI that still holds the unsigned tx, so the
// store is bounded by count and the newest orders are the ones kept. The cap
// matches the broadcast records: the largest batch the UI can produce.
export const TRON_RENTAL_ORDERS_MAX_COUNT = 500;

export class SimpleDbEntityChainResource extends SimpleDbEntityBase<IChainResourceDBStruct> {
  entityName = 'chainResource';

  override enableCache = false;

  @backgroundMethod()
  async getTronClaimResourceInfo({
    accountAddress,
  }: {
    accountAddress: string;
  }) {
    return (await this.getRawData())?.tronClaimResourceInfo?.[accountAddress];
  }

  @backgroundMethod()
  async updateTronClaimResourceInfo({
    accountAddress,
    lastClaimTime,
  }: {
    accountAddress: string;
    lastClaimTime: number;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      tronClaimResourceInfo: {
        ...rawData?.tronClaimResourceInfo,
        [accountAddress]: { lastClaimTime },
      },
    }));
  }

  async hasTronRentalOrder({ uuid }: { uuid: string }): Promise<boolean> {
    return Boolean((await this.getRawData())?.tronRentalOrders?.[uuid]);
  }

  async addTronRentalOrders({ uuids }: { uuids: string[] }): Promise<void> {
    if (!uuids.length) {
      return;
    }
    const orderedAt = Date.now();
    await this.setRawData((rawData) => {
      const orders = { ...rawData?.tronRentalOrders };
      for (const uuid of uuids) {
        orders[uuid] = { orderedAt };
      }
      return {
        ...rawData,
        tronRentalOrders: Object.fromEntries(
          Object.entries(orders)
            .toSorted(([, a], [, b]) => b.orderedAt - a.orderedAt)
            .slice(0, TRON_RENTAL_ORDERS_MAX_COUNT),
        ),
      };
    });
  }
}
