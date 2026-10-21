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

// Every record carries a signed payload, so the store is bounded by count,
// per class, and a record is only ever evicted by newer records of its own
// class. The cap is the largest batch the UI can produce (a CSV import of
// 500 rows, one tx per row in the many-senders mode), so a complete batch
// always fits and eviction never takes the record a retry depends on:
// - An ambiguous record (this runtime never got a txid) is what a retry
//   asks the chain about. Only newer ambiguous records can push it out, so
//   a bulk send cannot drop an early timeout before Retry is even available.
// - A broadcast record still awaiting the batch loop's bookkeeping is
//   replayed and then settled on retry; successes never squeeze it out.
// - A settled record is replayed so a retry of a landed tx is not signed
//   again (the caller's sent list does not survive the bridge on extension
//   and native). Pending records never count against it; only newer settled
//   records, from later batches or direct sends, can evict it.
// Nothing expires by age: a retry can only come from a UI that still holds
// the unsigned tx, and the chain, not the clock, decides whether a payload
// is still live.
export const BROADCAST_RECORDS_MAX_COUNT_PER_CLASS = 500;

function newestFirst(a: IBroadcastRecord, b: IBroadcastRecord): number {
  return b.attemptedAt - a.attemptedAt;
}

function keepNewest(records: IBroadcastRecord[]): IBroadcastRecord[] {
  return records
    .toSorted(newestFirst)
    .slice(0, BROADCAST_RECORDS_MAX_COUNT_PER_CLASS);
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
  const kept: Record<string, IBroadcastRecord> = {};
  for (const record of [
    ...keepNewest(ambiguous),
    ...keepNewest(broadcastUnsettled),
    ...keepNewest(settled),
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
