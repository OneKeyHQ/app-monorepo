import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  applyHeadlessBuyOrderTimeRules,
  applyOnramperTransactionStatus,
} from '@onekeyhq/shared/src/modules3rdParty/onramper/orderStatus';
import type {
  IHeadlessBuyOrder,
  IOnramperTransactionStatus,
} from '@onekeyhq/shared/types/fiatCrypto';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IHeadlessBuyOrdersDBStructure = {
  // Keyed by Onramper transactionId. Device-wide across all accounts (product
  // decision 2026-10-16): no per-account partitioning.
  orders: Record<string, IHeadlessBuyOrder>;
};

// One record before and after a rule / status round. `to` undefined means
// the record was deleted.
export type IHeadlessBuyOrderChange = {
  from: IHeadlessBuyOrder;
  to: IHeadlessBuyOrder | undefined;
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

  // Deletes a record only while it is still hidden and has never shown a
  // payment sign. The check runs inside the storage lock, so a `completed`
  // or `paymentAuthorized` write that landed after the caller's read wins.
  // Returns the deleted record.
  @backgroundMethod()
  async removeOrderIfHidden({
    transactionId,
  }: {
    transactionId: string;
  }): Promise<IHeadlessBuyOrder | undefined> {
    let removed: IHeadlessBuyOrder | undefined;
    await this.setRawData((raw) => {
      const orders = { ...raw?.orders };
      const existing = orders[transactionId];
      if (
        !existing ||
        existing.submittedAt !== undefined ||
        existing.paymentSeen
      ) {
        removed = undefined;
        return { orders };
      }
      removed = existing;
      delete orders[transactionId];
      return { orders };
    });
    return removed;
  }

  // Applies the time rules to every record. The steady state is a plain read;
  // when something has to change, the rules are re-run inside the storage
  // lock so they act on the records as they are now, not on a snapshot.
  // Returns the surviving records (unsorted) and what changed.
  @backgroundMethod()
  async applyTimeRules({ now }: { now: number }): Promise<{
    orders: IHeadlessBuyOrder[];
    changes: IHeadlessBuyOrderChange[];
  }> {
    const stored = await this.getOrders();
    if (
      stored.every(
        (order) => applyHeadlessBuyOrderTimeRules(order, now) === order,
      )
    ) {
      return { orders: stored, changes: [] };
    }
    let result: IHeadlessBuyOrder[] = [];
    let changes: IHeadlessBuyOrderChange[] = [];
    await this.setRawData((raw) => {
      const orders: Record<string, IHeadlessBuyOrder> = {};
      result = [];
      changes = [];
      for (const order of Object.values(raw?.orders ?? {})) {
        const next = applyHeadlessBuyOrderTimeRules(order, now);
        if (next) {
          orders[order.transactionId] = next;
          result.push(next);
        }
        if (next !== order) {
          changes.push({ from: order, to: next });
        }
      }
      return { orders };
    });
    return { orders: result, changes };
  }

  // Merges one status round. `statuses[id] === null` records a failed or
  // not-found lookup. The merge reads the current record inside the storage
  // lock, so a checkout write that landed while the lookups were in flight
  // (submittedAt, paymentSeen) is merged into rather than overwritten; ids
  // that no longer exist are skipped.
  @backgroundMethod()
  async applyTransactionStatuses({
    statuses,
    now,
  }: {
    statuses: Record<string, IOnramperTransactionStatus | null>;
    now: number;
  }): Promise<{ changes: IHeadlessBuyOrderChange[] }> {
    let changes: IHeadlessBuyOrderChange[] = [];
    await this.setRawData((raw) => {
      const orders = { ...raw?.orders };
      changes = [];
      for (const [transactionId, tx] of Object.entries(statuses)) {
        const existing = orders[transactionId];
        if (existing) {
          const next = tx
            ? applyOnramperTransactionStatus(existing, tx, now)
            : { ...existing, lastCheckedAt: now, lastCheckOk: false };
          if (next) {
            orders[transactionId] = next;
          } else {
            delete orders[transactionId];
          }
          changes.push({ from: existing, to: next });
        }
      }
      return { orders };
    });
    return { changes };
  }
}
