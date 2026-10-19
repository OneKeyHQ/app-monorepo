import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IHeadlessBuyOrder } from '@onekeyhq/shared/types/fiatCrypto';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IHeadlessBuyOrdersDBStructure = {
  // Keyed by Onramper transactionId. Device-wide across all accounts (product
  // decision 2026-10-16): no per-account partitioning.
  orders: Record<string, IHeadlessBuyOrder>;
};

// Device-local record of native (Onramper Headless) buy orders. The
// background service (ServiceFiatCrypto) owns every write; the UI reads
// through the proxy. Travel mode needs no handling here: the base class masks
// reads and drops writes while it is active.
export class SimpleDbEntityHeadlessBuyOrders extends SimpleDbEntityBase<IHeadlessBuyOrdersDBStructure> {
  entityName = 'headlessBuyOrders';

  override enableCache = false;

  @backgroundMethod()
  async getOrders(): Promise<IHeadlessBuyOrder[]> {
    const raw = await this.getRawData();
    return Object.values(raw?.orders ?? {}).toSorted(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  @backgroundMethod()
  async getOrder({
    transactionId,
  }: {
    transactionId: string;
  }): Promise<IHeadlessBuyOrder | undefined> {
    const raw = await this.getRawData();
    return raw?.orders?.[transactionId];
  }

  // One atomic write for any mix of writes (value) and deletes (null), so a
  // status refresh and a checkout event can never clobber each other.
  @backgroundMethod()
  async mergeOrders({
    updates,
  }: {
    updates: Record<string, IHeadlessBuyOrder | null>;
  }): Promise<void> {
    await this.setRawData((raw) => {
      const orders = { ...raw?.orders };
      for (const [transactionId, order] of Object.entries(updates)) {
        if (order === null) {
          delete orders[transactionId];
        } else {
          orders[transactionId] = order;
        }
      }
      return { orders };
    });
  }
}
