/*
yarn jest packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityBroadcastRecords.test.ts
*/
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

import {
  BROADCAST_RECORDS_MAX_SETTLED_COUNT,
  BROADCAST_RECORDS_UNSETTLED_RETENTION_MS,
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

function buildSettledRecord(uuid: string, attemptedAt: number) {
  return buildRecord(uuid, attemptedAt, { isBroadcast: true, isSettled: true });
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
  const now = 1_700_000_000_000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('upserts a record by uuid', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);

    await entity.upsertRecord(buildRecord('u1', now));
    const data = await applyBuilder(setRawData, {
      records: { u0: buildRecord('u0', now - 5_000) },
    });

    expect(new Set(Object.keys(data.records))).toEqual(new Set(['u0', 'u1']));
    expect(data.records.u1.attemptedAt).toBe(now);
  });

  it('drops the oldest settled records beyond the cap', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    const existing: Record<string, IBroadcastRecord> = {};
    for (let i = 0; i < BROADCAST_RECORDS_MAX_SETTLED_COUNT; i += 1) {
      existing[`u${i}`] = buildSettledRecord(`u${i}`, now - 10_000 + i);
    }

    await entity.upsertRecord(buildSettledRecord('newest', now));
    const data = await applyBuilder(setRawData, { records: existing });

    expect(Object.keys(data.records)).toHaveLength(
      BROADCAST_RECORDS_MAX_SETTLED_COUNT,
    );
    expect(data.records.u0).toBeUndefined();
    expect(data.records.newest).toBeDefined();
  });

  it('never evicts an open record by count, even when it is the oldest', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    // A bulk send that timed out on an early item, then settled more than
    // the cap worth of later items before Retry became available.
    const existing: Record<string, IBroadcastRecord> = {
      ambiguous: buildRecord('ambiguous', now - 60_000),
      broadcastUnsettled: buildRecord('broadcastUnsettled', now - 59_000, {
        isBroadcast: true,
      }),
    };
    for (let i = 0; i < BROADCAST_RECORDS_MAX_SETTLED_COUNT + 20; i += 1) {
      existing[`u${i}`] = buildSettledRecord(`u${i}`, now - 10_000 + i);
    }

    await entity.upsertRecord(buildRecord('newest', now));
    const data = await applyBuilder(setRawData, { records: existing });

    expect(data.records.ambiguous).toBeDefined();
    expect(data.records.broadcastUnsettled).toBeDefined();
    expect(data.records.newest).toBeDefined();
    const settledKept = Object.values(data.records).filter(
      (record) => record.isSettled,
    );
    expect(settledKept).toHaveLength(BROADCAST_RECORDS_MAX_SETTLED_COUNT);
    expect(data.records.u0).toBeUndefined();
  });

  it('expires open records only after the retention window', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    const existing: Record<string, IBroadcastRecord> = {
      stale: buildRecord(
        'stale',
        now - BROADCAST_RECORDS_UNSETTLED_RETENTION_MS,
      ),
      fresh: buildRecord(
        'fresh',
        now - BROADCAST_RECORDS_UNSETTLED_RETENTION_MS + 1,
      ),
    };

    await entity.upsertRecord(buildRecord('newest', now));
    const data = await applyBuilder(setRawData, { records: existing });

    expect(data.records.stale).toBeUndefined();
    expect(new Set(Object.keys(data.records))).toEqual(
      new Set(['fresh', 'newest']),
    );
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
