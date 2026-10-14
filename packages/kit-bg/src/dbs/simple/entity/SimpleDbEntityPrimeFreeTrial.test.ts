import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeFreeTrialUsageRecord } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import { buildPrimeFreeTrialUsageRecordKey } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import {
  type IPrimeFreeTrialDBStruct,
  PRIME_FREE_TRIAL_SETTLED_RECORD_RETENTION_MS,
  PRIME_FREE_TRIAL_SUCCESS_RECORD_RETENTION_MS,
  PRIME_FREE_TRIAL_USAGE_RECORDS_CAP_PER_USER,
  SimpleDbEntityPrimeFreeTrial,
} from './SimpleDbEntityPrimeFreeTrial';

const NOW = 1_800_000_000_000;
const MINUTE = 60 * 1000;

function setupEntity(records: IPrimeFreeTrialUsageRecord[]) {
  const entity = new SimpleDbEntityPrimeFreeTrial();
  let store: IPrimeFreeTrialDBStruct = {
    usageRecords: Object.fromEntries(
      records.map((record) => [
        buildPrimeFreeTrialUsageRecordKey(record),
        record,
      ]),
    ),
  };
  jest.spyOn(entity, 'getRawData').mockImplementation(async () => store);
  jest.spyOn(entity, 'setRawData').mockImplementation(async (builder) => {
    store = typeof builder === 'function' ? await builder(store) : builder;
    return store;
  });
  return { entity, getStore: () => store };
}

function usage(
  usageId: string,
  overrides: Partial<IPrimeFreeTrialUsageRecord> = {},
): IPrimeFreeTrialUsageRecord {
  return {
    onekeyUserId: 'user-a',
    featureId: EPrimeFeatures.BulkSend,
    usageId,
    startedAt: NOW - MINUTE,
    expiresAt: NOW + 29 * MINUTE,
    reportAttempts: 0,
    ...overrides,
  };
}

async function aliveUsageIds(entity: SimpleDbEntityPrimeFreeTrial) {
  return (await entity.getUsageRecords())
    .map((record) => record.usageId)
    .toSorted();
}

describe('SimpleDbEntityPrimeFreeTrial usage record retention', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a reported record for 24h so a late mark stays a no-op', async () => {
    const { entity } = setupEntity([
      usage('fresh', {
        result: 'success',
        reportedAt: NOW - PRIME_FREE_TRIAL_SETTLED_RECORD_RETENTION_MS + 1,
      }),
      usage('stale', {
        result: 'success',
        reportedAt: NOW - PRIME_FREE_TRIAL_SETTLED_RECORD_RETENTION_MS - 1,
      }),
    ]);

    expect(await aliveUsageIds(entity)).toEqual(['fresh']);
  });

  it('keeps an unreported success for 30 days from its result', async () => {
    const { entity } = setupEntity([
      usage('recent', {
        result: 'success',
        startedAt: NOW - PRIME_FREE_TRIAL_SUCCESS_RECORD_RETENTION_MS - 10,
        resultAt: NOW - PRIME_FREE_TRIAL_SUCCESS_RECORD_RETENTION_MS + 1,
      }),
      usage('old', {
        result: 'success',
        resultAt: NOW - PRIME_FREE_TRIAL_SUCCESS_RECORD_RETENTION_MS - 1,
      }),
    ]);

    expect(await aliveUsageIds(entity)).toEqual(['recent']);
  });

  it('drops a failed / cancelled record once its reservation ended', async () => {
    const { entity } = setupEntity([
      usage('failed-alive', { result: 'failed', expiresAt: NOW + 1 }),
      usage('failed-expired', { result: 'failed', expiresAt: NOW }),
      usage('cancelled-expired', { result: 'cancelled', expiresAt: NOW - 1 }),
    ]);

    expect(await aliveUsageIds(entity)).toEqual(['failed-alive']);
  });

  it('keeps a running usage until 24h after its reservation ended', async () => {
    const { entity } = setupEntity([
      usage('running', {
        expiresAt: NOW - PRIME_FREE_TRIAL_SETTLED_RECORD_RETENTION_MS + 1,
      }),
      usage('abandoned', {
        expiresAt: NOW - PRIME_FREE_TRIAL_SETTLED_RECORD_RETENTION_MS,
      }),
      // Without a server expiry: local start + 30 min.
      usage('unknown-expiry', {
        expiresAt: undefined,
        startedAt: NOW - PRIME_FREE_TRIAL_SETTLED_RECORD_RETENTION_MS,
      }),
    ]);

    expect(await aliveUsageIds(entity)).toEqual(['running', 'unknown-expiry']);
  });

  it('caps each user to the newest records and leaves other users alone', async () => {
    const cap = PRIME_FREE_TRIAL_USAGE_RECORDS_CAP_PER_USER;
    const records = Array.from({ length: cap + 2 }, (_, index) =>
      usage(`a-${String(index).padStart(3, '0')}`, {
        startedAt: NOW - (cap + 2 - index) * 1000,
      }),
    );
    const { entity } = setupEntity([
      ...records,
      usage('b-000', { onekeyUserId: 'user-b', startedAt: NOW - 10 * MINUTE }),
    ]);

    const alive = await aliveUsageIds(entity);

    expect(alive).toHaveLength(cap + 1);
    expect(alive).not.toContain('a-000');
    expect(alive).not.toContain('a-001');
    expect(alive).toContain(`a-${String(cap + 1).padStart(3, '0')}`);
    expect(alive).toContain('b-000');
  });

  it('prunes on write and deletes a record when the updater returns undefined', async () => {
    const { entity, getStore } = setupEntity([
      usage('expired', { result: 'failed', expiresAt: NOW - 1 }),
      usage('removed'),
    ]);

    await entity.updateUsageRecord(usage('removed'), () => undefined);

    expect(Object.keys(getStore().usageRecords ?? {})).toEqual([]);
  });
});
