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

  // Inserts only when no record exists yet. Returns whether it inserted:
  // the pre-payment record and the `completed` fallback can race (both are
  // async), and the first writer must win without being overwritten.
  @backgroundMethod()
  async insertOrderIfAbsent({
    order,
  }: {
    order: IHeadlessBuyOrder;
  }): Promise<boolean> {
    let inserted = false;
    await this.setRawData((raw) => {
      const orders = { ...raw?.orders };
      if (orders[order.transactionId]) {
        inserted = false;
        return { orders };
      }
      inserted = true;
      orders[order.transactionId] = order;
      return { orders };
    });
    return inserted;
  }

  // Merges `patch` into an existing record atomically (read-modify-write
  // inside the storage lock). Returns the updated record, or undefined when
  // there is nothing to patch.
  @backgroundMethod()
  async patchOrder({
    transactionId,
    patch,
  }: {
    transactionId: string;
    patch: Partial<IHeadlessBuyOrder>;
  }): Promise<IHeadlessBuyOrder | undefined> {
    let updated: IHeadlessBuyOrder | undefined;
    await this.setRawData((raw) => {
      const orders = { ...raw?.orders };
      const existing = orders[transactionId];
      if (!existing) {
        updated = undefined;
        return { orders };
      }
      updated = { ...existing, ...patch };
      orders[transactionId] = updated;
      return { orders };
    });
    return updated;
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
