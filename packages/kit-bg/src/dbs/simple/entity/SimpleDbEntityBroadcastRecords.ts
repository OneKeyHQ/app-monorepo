import { omit } from 'lodash';

import type { ISignedTxPro } from '@onekeyhq/core/src/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// A signed transaction that left this device for the network, keyed by the
// unsignedTx uuid the confirm page keeps across retries (OK-65147).
export interface IBroadcastRecord {
  uuid: string;
  networkId: string;
  accountId: string;
  signedTx: ISignedTxPro;
  // When the broadcast first left this runtime; also bounds how long the
  // payload can still be valid on chains with an expiry.
  attemptedAt: number;
  // A node returned a txid for it.
  isBroadcast: boolean;
  // Nothing is left to gate for this record: the batch loop's post-broadcast
  // bookkeeping (signature record, local history) ran, or the caller owns
  // that bookkeeping (direct send) and only ever replays the signed result.
  isSettled: boolean;
}

export interface IBroadcastRecordsDb {
  records: Record<string, IBroadcastRecord>;
}

// Every record carries a signed payload, so each class of record is bounded
// by count, and eviction never takes the record a retry depends on:
// - An ambiguous record (this runtime never got a txid) is what a retry asks
//   the chain about. Only newer ambiguous records can push it out, never
//   successes, so a bulk send cannot drop an early timeout before Retry is
//   even available; the cap covers the largest batch the UI can produce.
// - A record that reached the network is replayed on retry. Settled ones go
//   first; one still awaiting the batch loop's bookkeeping is evicted only
//   when newer unsettled broadcasts alone fill the cap.
// Nothing expires by age: a retry can only come from a UI that still holds
// the unsigned tx, and the chain, not the clock, decides whether a payload
// is still live.
export const BROADCAST_RECORDS_MAX_AMBIGUOUS_COUNT = 500;
export const BROADCAST_RECORDS_MAX_BROADCAST_COUNT = 100;

function newestFirst(a: IBroadcastRecord, b: IBroadcastRecord): number {
  return b.attemptedAt - a.attemptedAt;
}

function trimRecords(
  records: Record<string, IBroadcastRecord>,
): Record<string, IBroadcastRecord> {
  const ambiguous: IBroadcastRecord[] = [];
  const broadcastUnsettled: IBroadcastRecord[] = [];
  const settled: IBroadcastRecord[] = [];
  for (const record of Object.values(records)) {
    if (record.isSettled) {
      settled.push(record);
    } else if (record.isBroadcast) {
      broadcastUnsettled.push(record);
    } else {
      ambiguous.push(record);
    }
  }
  const keptBroadcast = broadcastUnsettled
    .toSorted(newestFirst)
    .slice(0, BROADCAST_RECORDS_MAX_BROADCAST_COUNT);
  keptBroadcast.push(
    ...settled
      .toSorted(newestFirst)
      .slice(0, BROADCAST_RECORDS_MAX_BROADCAST_COUNT - keptBroadcast.length),
  );
  const kept: Record<string, IBroadcastRecord> = {};
  for (const record of [
    ...ambiguous
      .toSorted(newestFirst)
      .slice(0, BROADCAST_RECORDS_MAX_AMBIGUOUS_COUNT),
    ...keptBroadcast,
  ]) {
    kept[record.uuid] = record;
  }
  return kept;
}

export class SimpleDbEntityBroadcastRecords extends SimpleDbEntityBase<IBroadcastRecordsDb> {
  entityName = 'broadcastRecords';

  override enableCache = true;

  async getRecord(uuid: string): Promise<IBroadcastRecord | undefined> {
    const data = await this.getRawData();
    return data?.records?.[uuid];
  }

  async upsertRecord(record: IBroadcastRecord): Promise<void> {
    await this.setRawData((rawData) => ({
      records: trimRecords({
        ...rawData?.records,
        [record.uuid]: record,
      }),
    }));
  }

  async updateRecord(
    uuid: string,
    patch: Partial<Omit<IBroadcastRecord, 'uuid'>>,
  ): Promise<void> {
    await this.setRawData((rawData) => {
      const records = rawData?.records ?? {};
      const record = records[uuid];
      if (!record) {
        return { records };
      }
      return { records: { ...records, [uuid]: { ...record, ...patch } } };
    });
  }

  async deleteRecord(uuid: string): Promise<void> {
    await this.setRawData((rawData) => ({
      records: omit(rawData?.records ?? {}, uuid),
    }));
  }
}
