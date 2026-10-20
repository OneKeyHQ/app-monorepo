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
  // The post-broadcast bookkeeping (signature record, local history) ran.
  isSettled: boolean;
}

export interface IBroadcastRecordsDb {
  records: Record<string, IBroadcastRecord>;
}

// Only recent uuids are ever retried; keep the store small since every
// record carries a signed payload.
export const BROADCAST_RECORDS_MAX_COUNT = 100;

function trimRecords(
  records: Record<string, IBroadcastRecord>,
): Record<string, IBroadcastRecord> {
  const entries = Object.values(records);
  if (entries.length <= BROADCAST_RECORDS_MAX_COUNT) {
    return records;
  }
  entries.sort((a, b) => b.attemptedAt - a.attemptedAt);
  const kept: Record<string, IBroadcastRecord> = {};
  for (const record of entries.slice(0, BROADCAST_RECORDS_MAX_COUNT)) {
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
