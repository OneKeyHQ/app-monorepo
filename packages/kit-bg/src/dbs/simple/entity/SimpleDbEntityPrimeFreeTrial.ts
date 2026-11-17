import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IPrimeFreeTrialPendingAction,
  IPrimeFreeTrialUsageFeatureId,
  IPrimeFreeTrialUsageRecord,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import { buildPrimeFreeTrialUsageRecordKey } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Retention caps for usage records: a dropped record only means an
// under-count, which is the accepted failure direction.
export const PRIME_FREE_TRIAL_USAGE_RECORDS_CAP_PER_USER = 50;
export const PRIME_FREE_TRIAL_SUCCESS_RECORD_RETENTION_MS =
  30 * 24 * 60 * 60 * 1000;
// How long a settled record (or the owner of a reservation) is kept after it
// stops being reportable, so a late mark of the same usage stays a no-op.
export const PRIME_FREE_TRIAL_SETTLED_RECORD_RETENTION_MS = 24 * 60 * 60 * 1000;
// Fallback reservation lifetime when the server expiry is unknown.
const RESERVATION_FALLBACK_TTL_MS = 30 * 60 * 1000;

export interface IPrimeFreeTrialDBStruct {
  usageRecords?: Record<string, IPrimeFreeTrialUsageRecord>;
  pendingAction?: IPrimeFreeTrialPendingAction;
}

function isRecordExpired(record: IPrimeFreeTrialUsageRecord, now: number) {
  if (record.reportedAt) {
    return (
      now - record.reportedAt > PRIME_FREE_TRIAL_SETTLED_RECORD_RETENTION_MS
    );
  }
  if (record.result === 'success') {
    const anchor = record.resultAt ?? record.startedAt;
    return now - anchor > PRIME_FREE_TRIAL_SUCCESS_RECORD_RETENTION_MS;
  }
  const reservationEnd =
    record.expiresAt ?? record.startedAt + RESERVATION_FALLBACK_TTL_MS;
  if (record.result) {
    // A failed / cancelled report is only useful while its reservation is
    // alive: the server releases expired reservations by itself.
    return reservationEnd <= now;
  }
  // No result yet: keep the owner for a late success (an expired
  // reservation is still charged when success arrives).
  return reservationEnd + PRIME_FREE_TRIAL_SETTLED_RECORD_RETENTION_MS <= now;
}

function pruneUsageRecords(
  usageRecords: Record<string, IPrimeFreeTrialUsageRecord>,
  now: number,
) {
  const alive = Object.entries(usageRecords).filter(
    ([, record]) => !isRecordExpired(record, now),
  );
  const byUser = new Map<string, Array<[string, IPrimeFreeTrialUsageRecord]>>();
  alive.forEach((entry) => {
    const list = byUser.get(entry[1].onekeyUserId) ?? [];
    list.push(entry);
    byUser.set(entry[1].onekeyUserId, list);
  });
  const result: Record<string, IPrimeFreeTrialUsageRecord> = {};
  byUser.forEach((list) => {
    list
      .toSorted(([, a], [, b]) => b.startedAt - a.startedAt)
      .slice(0, PRIME_FREE_TRIAL_USAGE_RECORDS_CAP_PER_USER)
      .forEach(([key, record]) => {
        result[key] = record;
      });
  });
  return result;
}

export class SimpleDbEntityPrimeFreeTrial extends SimpleDbEntityBase<IPrimeFreeTrialDBStruct> {
  entityName = 'primeFreeTrial';

  override enableCache = false;

  async getUsageRecord(params: {
    onekeyUserId: string;
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
  }): Promise<IPrimeFreeTrialUsageRecord | undefined> {
    const rawData = await this.getRawData();
    return rawData?.usageRecords?.[buildPrimeFreeTrialUsageRecordKey(params)];
  }

  async getUsageRecords(): Promise<IPrimeFreeTrialUsageRecord[]> {
    const rawData = await this.getRawData();
    return Object.values(
      pruneUsageRecords(rawData?.usageRecords ?? {}, Date.now()),
    );
  }

  // `updater` receives the current record (undefined when missing) and
  // returns the next one; returning undefined deletes the record.
  async updateUsageRecord(
    key: {
      onekeyUserId: string;
      featureId: IPrimeFreeTrialUsageFeatureId;
      usageId: string;
    },
    updater: (
      record: IPrimeFreeTrialUsageRecord | undefined,
    ) => IPrimeFreeTrialUsageRecord | undefined,
  ): Promise<IPrimeFreeTrialUsageRecord | undefined> {
    const recordKey = buildPrimeFreeTrialUsageRecordKey(key);
    let nextRecord: IPrimeFreeTrialUsageRecord | undefined;
    await this.setRawData((rawData) => {
      const usageRecords = { ...rawData?.usageRecords };
      nextRecord = updater(usageRecords[recordKey]);
      if (nextRecord) {
        usageRecords[recordKey] = nextRecord;
      } else {
        delete usageRecords[recordKey];
      }
      return {
        ...rawData,
        usageRecords: pruneUsageRecords(usageRecords, Date.now()),
      };
    });
    return nextRecord;
  }

  async deleteUsageRecordsOfUser({ onekeyUserId }: { onekeyUserId: string }) {
    await this.setRawData((rawData) => {
      const usageRecords = Object.fromEntries(
        Object.entries(rawData?.usageRecords ?? {}).filter(
          ([, record]) => record.onekeyUserId !== onekeyUserId,
        ),
      );
      return { ...rawData, usageRecords };
    });
  }

  @backgroundMethod()
  async getPendingAction(): Promise<IPrimeFreeTrialPendingAction | undefined> {
    const rawData = await this.getRawData();
    return rawData?.pendingAction;
  }

  async setPendingAction(pendingAction: IPrimeFreeTrialPendingAction) {
    await this.setRawData((rawData) => ({ ...rawData, pendingAction }));
  }

  // Removes the slot only when it still matches `predicate`, so a newer
  // action written meanwhile is kept.
  async clearPendingAction(
    predicate?: (pendingAction: IPrimeFreeTrialPendingAction) => boolean,
  ) {
    await this.setRawData((rawData) => {
      const current = rawData?.pendingAction;
      if (current && predicate && !predicate(current)) {
        return { ...rawData };
      }
      return { ...rawData, pendingAction: undefined };
    });
  }
}
