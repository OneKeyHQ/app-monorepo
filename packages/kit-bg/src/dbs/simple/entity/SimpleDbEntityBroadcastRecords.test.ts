/*
yarn jest packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityBroadcastRecords.test.ts
*/
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

import {
  BROADCAST_RECORDS_MAX_AMBIGUOUS_COUNT,
  BROADCAST_RECORDS_MAX_BROADCAST_COUNT,
  SimpleDbEntityBroadcastRecords,
} from './SimpleDbEntityBroadcastRecords';

import type { IBroadcastRecord } from './SimpleDbEntityBroadcastRecords';

function buildRecord(
  uuid: string,
  attemptedAt: number,
  overrides: Partial<IBroadcastRecord> = {},
): IBroadcastRecord {
  return {
    uuid,
    networkId: 'sol--101',
    accountId: 'hd-1--0',
    signedTx: { txid: `sig-${uuid}`, rawTx: '', encodedTx: '' } as ISignedTxPro,
    attemptedAt,
    isBroadcast: false,
    isSettled: false,
    ...overrides,
  };
}

function buildBroadcastRecord(uuid: string, attemptedAt: number) {
  return buildRecord(uuid, attemptedAt, { isBroadcast: true });
}

function buildSettledRecord(uuid: string, attemptedAt: number) {
  return buildRecord(uuid, attemptedAt, { isBroadcast: true, isSettled: true });
}

function fill(
  records: Record<string, IBroadcastRecord>,
  prefix: string,
  count: number,
  build: (uuid: string, attemptedAt: number) => IBroadcastRecord,
  attemptedAtBase: number,
) {
  for (let i = 0; i < count; i += 1) {
    const uuid = `${prefix}${i}`;
    records[uuid] = build(uuid, attemptedAtBase + i);
  }
}

async function applyBuilder(
  setRawData: jest.SpyInstance,
  rawData: unknown,
): Promise<{ records: Record<string, IBroadcastRecord> }> {
  const builder = setRawData.mock.calls.at(-1)?.[0] as (
    data: unknown,
  ) => Promise<{ records: Record<string, IBroadcastRecord> }>;
  return builder(rawData);
}

describe('SimpleDbEntityBroadcastRecords', () => {
  it('upserts a record by uuid', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);

    await entity.upsertRecord(buildRecord('u1', 10));
    const data = await applyBuilder(setRawData, {
      records: { u0: buildRecord('u0', 5) },
    });

    expect(new Set(Object.keys(data.records))).toEqual(new Set(['u0', 'u1']));
    expect(data.records.u1.attemptedAt).toBe(10);
  });

  it('drops the oldest settled records beyond the broadcast cap', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    const existing: Record<string, IBroadcastRecord> = {};
    fill(
      existing,
      'u',
      BROADCAST_RECORDS_MAX_BROADCAST_COUNT,
      buildSettledRecord,
      1000,
    );

    await entity.upsertRecord(buildSettledRecord('newest', 10_000));
    const data = await applyBuilder(setRawData, { records: existing });

    expect(Object.keys(data.records)).toHaveLength(
      BROADCAST_RECORDS_MAX_BROADCAST_COUNT,
    );
    expect(data.records.u0).toBeUndefined();
    expect(data.records.newest).toBeDefined();
  });

  it('evicts settled records before a broadcast one that still awaits its bookkeeping', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    const existing: Record<string, IBroadcastRecord> = {
      awaitingBookkeeping: buildBroadcastRecord('awaitingBookkeeping', 1),
    };
    fill(
      existing,
      'u',
      BROADCAST_RECORDS_MAX_BROADCAST_COUNT + 20,
      buildSettledRecord,
      1000,
    );

    await entity.upsertRecord(buildSettledRecord('newest', 10_000));
    const data = await applyBuilder(setRawData, { records: existing });

    expect(data.records.awaitingBookkeeping).toBeDefined();
    expect(data.records.newest).toBeDefined();
    expect(Object.keys(data.records)).toHaveLength(
      BROADCAST_RECORDS_MAX_BROADCAST_COUNT,
    );
    expect(data.records.u0).toBeUndefined();
  });

  it('never lets successes evict an ambiguous record, even the oldest one', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    // A bulk send that timed out on an early item and then broadcast far
    // more than the cap worth of later items before Retry became available.
    const existing: Record<string, IBroadcastRecord> = {
      ambiguous: buildRecord('ambiguous', 1),
    };
    fill(
      existing,
      's',
      BROADCAST_RECORDS_MAX_BROADCAST_COUNT + 20,
      buildSettledRecord,
      1000,
    );
    fill(
      existing,
      'b',
      BROADCAST_RECORDS_MAX_BROADCAST_COUNT + 20,
      buildBroadcastRecord,
      5000,
    );

    await entity.upsertRecord(buildRecord('newest', 10_000));
    const data = await applyBuilder(setRawData, { records: existing });

    expect(data.records.ambiguous).toBeDefined();
    expect(data.records.newest).toBeDefined();
    const broadcastKept = Object.values(data.records).filter(
      (record) => record.isBroadcast,
    );
    expect(broadcastKept).toHaveLength(BROADCAST_RECORDS_MAX_BROADCAST_COUNT);
    expect(broadcastKept.every((record) => !record.isSettled)).toBe(true);
  });

  it('caps ambiguous records only by newer ambiguous records', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    const existing: Record<string, IBroadcastRecord> = {};
    fill(
      existing,
      'a',
      BROADCAST_RECORDS_MAX_AMBIGUOUS_COUNT,
      buildRecord,
      1000,
    );

    await entity.upsertRecord(buildRecord('newest', 10_000));
    const data = await applyBuilder(setRawData, { records: existing });

    expect(Object.keys(data.records)).toHaveLength(
      BROADCAST_RECORDS_MAX_AMBIGUOUS_COUNT,
    );
    expect(data.records.a0).toBeUndefined();
    expect(data.records.a1).toBeDefined();
    expect(data.records.newest).toBeDefined();
  });

  it('merges a patch into an existing record and ignores unknown uuids', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);

    await entity.updateRecord('u0', { isBroadcast: true });
    const updated = await applyBuilder(setRawData, {
      records: { u0: buildRecord('u0', 5) },
    });
    expect(updated.records.u0.isBroadcast).toBe(true);
    expect(updated.records.u0.attemptedAt).toBe(5);

    await entity.updateRecord('missing', { isBroadcast: true });
    const untouched = await applyBuilder(setRawData, {
      records: { u0: buildRecord('u0', 5) },
    });
    expect(Object.keys(untouched.records)).toEqual(['u0']);
  });

  it('deletes a record and reads one back', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      records: { u0: buildRecord('u0', 5) },
    });

    await expect(entity.getRecord('u0')).resolves.toMatchObject({ uuid: 'u0' });
    await expect(entity.getRecord('u1')).resolves.toBeUndefined();

    await entity.deleteRecord('u0');
    const data = await applyBuilder(setRawData, {
      records: { u0: buildRecord('u0', 5), u1: buildRecord('u1', 6) },
    });
    expect(Object.keys(data.records)).toEqual(['u1']);
  });
});
