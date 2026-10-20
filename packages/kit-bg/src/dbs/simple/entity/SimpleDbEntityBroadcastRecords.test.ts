/*
yarn jest packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityBroadcastRecords.test.ts
*/
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

import {
  BROADCAST_RECORDS_MAX_COUNT,
  SimpleDbEntityBroadcastRecords,
} from './SimpleDbEntityBroadcastRecords';

import type { IBroadcastRecord } from './SimpleDbEntityBroadcastRecords';

function buildRecord(uuid: string, attemptedAt: number): IBroadcastRecord {
  return {
    uuid,
    networkId: 'sol--101',
    accountId: 'hd-1--0',
    signedTx: { txid: `sig-${uuid}`, rawTx: '', encodedTx: '' } as ISignedTxPro,
    attemptedAt,
    isBroadcast: false,
    isSettled: false,
  };
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

  it('drops the oldest records beyond the cap', async () => {
    const entity = new SimpleDbEntityBroadcastRecords();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    const existing: Record<string, IBroadcastRecord> = {};
    for (let i = 0; i < BROADCAST_RECORDS_MAX_COUNT; i += 1) {
      existing[`u${i}`] = buildRecord(`u${i}`, i);
    }

    await entity.upsertRecord(buildRecord('newest', 10_000));
    const data = await applyBuilder(setRawData, { records: existing });

    expect(Object.keys(data.records)).toHaveLength(BROADCAST_RECORDS_MAX_COUNT);
    expect(data.records.u0).toBeUndefined();
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
