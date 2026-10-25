import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ICloudSyncReconciliationAdapter,
  ICloudSyncReconciliationContract,
  ICloudSyncReconciliationSummary,
} from '@onekeyhq/shared/types/prime/cloudSyncReconciliation';
import type {
  ICloudSyncCheckServerStatusResult,
  ICloudSyncServerItem,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import {
  measureCloudSyncReconciliationSummary,
  runCloudSyncReconciliation,
} from './cloudSyncReconciliation';

function record(
  index: number,
  data = 'public-synthetic-ciphertext',
): ICloudSyncServerItem {
  return {
    key: `public-${index}`,
    data,
    dataTimestamp: 1_750_000_000_000 + index,
    dataType: EPrimeCloudSyncDataType.Account,
    isDeleted: false,
    pwdHash: 'public-test-space',
  };
}

function contract(
  overrides: Partial<ICloudSyncReconciliationContract> = {},
): ICloudSyncReconciliationContract {
  return {
    version: 1,
    diffBeforeLimit: true,
    includesDeleted: true,
    hasMore: false,
    maxItems: 500,
    maxBytes: 1024 * 1024,
    ...overrides,
  };
}

function response(
  overrides: Partial<ICloudSyncCheckServerStatusResult> = {},
): ICloudSyncCheckServerStatusResult {
  return {
    diff: [],
    updated: [],
    deleted: [],
    obsoleted: [],
    pwdHash: 'public-test-space',
    serverTime: 1_750_000_000_000,
    reconciliation: {
      version: 1,
      diffBeforeLimit: true,
      includesDeleted: true,
      hasMore: false,
      maxItems: 500,
      maxBytes: 1024 * 1024,
    },
    ...overrides,
  };
}

function harness(count = 0) {
  const remote = new Map(
    Array.from({ length: count }, (_, index) => {
      const row = record(index);
      return [row.key, row] as const;
    }),
  );
  const local = new Map<string, ICloudSyncReconciliationSummary[number]>();
  let current = true;
  let clock = 1_750_000_000_000;
  const check = jest.fn(
    async ({
      localData,
      reconciliation,
    }: Parameters<ICloudSyncReconciliationAdapter['check']>[0]) => {
      const submitted = new Map(localData.map((row) => [row.key, row]));
      // A synthetic server computes ALL differences before limiting the reply.
      const deleted = localData
        .filter((row) => !remote.has(row.key))
        .map((row) => row.key);
      const diff = Array.from(remote.values()).filter(
        (row) => submitted.get(row.key)?.dataTimestamp !== row.dataTimestamp,
      );
      const work = [
        ...deleted.map((key) => ({ deleted: key })),
        ...diff.map((row) => ({ row })),
      ];
      const batch = work.slice(0, reconciliation.maxItems);
      return response({
        deleted: batch.flatMap((item) =>
          'deleted' in item ? [item.deleted] : [],
        ),
        diff: batch.flatMap((item) => ('row' in item ? [item.row] : [])),
        reconciliation: {
          ...reconciliation,
          diffBeforeLimit: true,
          includesDeleted: true,
          hasMore: work.length > batch.length,
        },
      });
    },
  );
  const getFullSummary = jest.fn(async () =>
    Array.from(local.values()).map((row) => ({ ...row })),
  );
  const apply = jest.fn(
    async ({
      response: batch,
    }: Parameters<ICloudSyncReconciliationAdapter['apply']>[0]) => {
      let applied = 0;
      for (const key of batch.deleted) if (local.delete(key)) applied += 1;
      for (const row of [...batch.diff, ...batch.updated]) {
        if (local.get(row.key)?.dataTimestamp !== row.dataTimestamp)
          applied += 1;
        local.set(row.key, {
          key: row.key,
          dataTimestamp: row.dataTimestamp,
          dataType: row.dataType,
        });
      }
      return { applied };
    },
  );
  const uploadObsoleted = jest.fn(
    async ({
      keys,
    }: Parameters<ICloudSyncReconciliationAdapter['uploadObsoleted']>[0]) => ({
      uploaded: keys.length,
    }),
  );
  const pause = jest.fn(
    async ({
      delayMs,
    }: Parameters<ICloudSyncReconciliationAdapter['pause']>[0]) => {
      clock += delayMs;
    },
  );
  const adapter: ICloudSyncReconciliationAdapter = {
    check,
    getFullSummary,
    apply,
    uploadObsoleted,
    pause,
    now: () => clock,
    isCurrent: () => current,
    isBoundedCheckVerified: () => true,
  };
  return {
    adapter,
    local,
    remote,
    check,
    getFullSummary,
    apply,
    uploadObsoleted,
    pause,
    changeSource: () => {
      current = false;
    },
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('bounded Cloud reconciliation with full summaries', () => {
  afterEach(() => jest.useRealTimers());

  test('drains more than 500 including deletions and rereads the complete summary after every batch', async () => {
    const h = harness(1300);
    for (let index = 0; index < 3; index += 1)
      h.local.set(`deleted-${index}`, {
        key: `deleted-${index}`,
        dataType: EPrimeCloudSyncDataType.Account,
        dataTimestamp: 1,
      });
    const result = await runCloudSyncReconciliation({ adapter: h.adapter });
    expect(result).toMatchObject({
      status: 'complete',
      unfinished: false,
      requests: 3,
      rounds: 3,
      received: 1303,
      applied: 1303,
    });
    expect(
      h.check.mock.calls.map(([params]) => params.localData.length),
    ).toEqual([3, 497, 997]);
    expect(h.getFullSummary).toHaveBeenCalledTimes(4);
    expect(h.local.size).toBe(1300);
    expect(h.check.mock.calls.every(([params]) => !('cursor' in params))).toBe(
      true,
    );
  });

  test('a progressing budget exhaustion waits and a new run resumes from the whole current DB summary', async () => {
    const h = harness(1300);
    const first = await runCloudSyncReconciliation({
      adapter: h.adapter,
      limits: { maxRequests: 2 },
    });
    expect(first).toMatchObject({
      status: 'waiting',
      reason: 'request-budget',
      requests: 2,
      progress: true,
      unfinished: true,
    });
    expect(first.nextRetryAt).toBe(h.adapter.now() + 1000);
    const second = await runCloudSyncReconciliation({
      adapter: h.adapter,
      limits: { maxRequests: 2 },
    });
    expect(second).toMatchObject({
      status: 'complete',
      requests: 1,
      received: 300,
    });
    expect(h.local.size).toBe(1300);
    expect(h.check.mock.calls[2][0].localData).toHaveLength(1000);
  });

  test('progressing time exhaustion schedules continuation without exceeding its request budget', async () => {
    const h = harness(1000);
    h.apply.mockImplementationOnce(async ({ response: batch }) => {
      batch.diff.forEach((row) =>
        h.local.set(row.key, {
          key: row.key,
          dataTimestamp: row.dataTimestamp,
          dataType: row.dataType,
        }),
      );
      h.advance(100);
      return { applied: batch.diff.length };
    });
    const result = await runCloudSyncReconciliation({
      adapter: h.adapter,
      limits: { maxDurationMs: 100 },
    });
    expect(result).toMatchObject({
      status: 'waiting',
      reason: 'time-budget',
      requests: 1,
      progress: true,
    });
    expect(result.nextRetryAt).toBeDefined();
  });

  test('old large backend replies are handled once without claiming completion or new response caps', async () => {
    const h = harness();
    const batch = Array.from({ length: 700 }, (_, index) =>
      record(index, 'public-data-'.repeat(250)),
    );
    h.check.mockResolvedValue(
      response({ diff: batch, reconciliation: undefined }),
    );
    const result = await runCloudSyncReconciliation({ adapter: h.adapter });
    expect(result).toMatchObject({
      status: 'backend-unverified',
      unfinished: true,
      requests: 1,
      received: 700,
    });
    expect(h.apply).toHaveBeenCalledTimes(1);
    expect(h.local.size).toBe(700);
    expect(result.nextRetryAt).toBeUndefined();
  });

  test('a legacy processing failure never starts a second compatibility check in the same run', async () => {
    const h = harness();
    h.check.mockResolvedValue(
      response({ diff: [record(0)], reconciliation: undefined }),
    );
    h.apply.mockRejectedValue(new OneKeyLocalError('synthetic local failure'));
    expect(
      await runCloudSyncReconciliation({ adapter: h.adapter }),
    ).toMatchObject({
      status: 'backend-unverified',
      reason: 'retry-exhausted',
      failures: 1,
      requests: 1,
      unfinished: true,
    });
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(h.pause).not.toHaveBeenCalled();
  });

  test.each([
    undefined,
    {
      version: 2,
      diffBeforeLimit: true,
      includesDeleted: true,
      hasMore: true,
      maxItems: 500,
      maxBytes: 1024 * 1024,
    },
    {
      version: 1,
      diffBeforeLimit: false,
      includesDeleted: true,
      hasMore: true,
      maxItems: 500,
      maxBytes: 1024 * 1024,
    },
    {
      version: 1,
      diffBeforeLimit: true,
      includesDeleted: false,
      hasMore: true,
      maxItems: 500,
      maxBytes: 1024 * 1024,
    },
    {
      version: 1,
      diffBeforeLimit: true,
      includesDeleted: true,
      maxItems: 500,
      maxBytes: 1024 * 1024,
    },
  ])(
    'unrecognized declarations only permit one compatibility pass: %j',
    async (declaration) => {
      const h = harness();
      h.check.mockResolvedValue(
        response({
          diff: [record(0)],
          reconciliation: declaration as
            | ICloudSyncReconciliationContract
            | undefined,
        }),
      );
      expect(
        (await runCloudSyncReconciliation({ adapter: h.adapter })).status,
      ).toBe('backend-unverified');
      expect(h.check).toHaveBeenCalledTimes(1);
    },
  );

  test('a local verifier can reject a declaration without manufacturing backend verification', async () => {
    const h = harness(1000);
    h.adapter.isBoundedCheckVerified = () => false;
    expect(
      (await runCloudSyncReconciliation({ adapter: h.adapter })).status,
    ).toBe('backend-unverified');
    expect(h.check).toHaveBeenCalledTimes(1);
  });

  test('verified response count and serialized bytes are hard limits before application', async () => {
    for (const batch of [
      Array.from({ length: 501 }, (_, index) => record(index)),
      [record(0, 'x'.repeat(1024 * 1024))],
    ]) {
      const h = harness();
      h.check.mockResolvedValue(response({ diff: batch }));
      const result = await runCloudSyncReconciliation({ adapter: h.adapter });
      expect(result).toMatchObject({
        status: 'blocked',
        reason: 'response-budget',
        unfinished: true,
      });
      expect(h.apply).not.toHaveBeenCalled();
      expect(result.nextRetryAt).toBeDefined();
    }
  });

  test('no progress stops without a permanent gate and a later controlled run can succeed', async () => {
    const h = harness();
    h.check.mockResolvedValue(
      response({
        diff: [record(0)],
        reconciliation: contract({ hasMore: true }),
      }),
    );
    h.apply.mockResolvedValue({ applied: 0 });
    expect(
      await runCloudSyncReconciliation({ adapter: h.adapter }),
    ).toMatchObject({ status: 'blocked', reason: 'no-progress', requests: 1 });
    h.check.mockResolvedValue(response());
    expect(
      (await runCloudSyncReconciliation({ adapter: h.adapter })).status,
    ).toBe('complete');
  });

  test('repeated work is detected even if serverTime changes and an adapter claims progress', async () => {
    const h = harness();
    let serverTime = 1;
    h.check.mockImplementation(async () => {
      const currentServerTime = serverTime;
      serverTime += 1;
      return response({
        diff: [record(0)],
        serverTime: currentServerTime,
        reconciliation: contract({ hasMore: true }),
      });
    });
    h.apply.mockResolvedValue({ applied: 1 });
    const result = await runCloudSyncReconciliation({ adapter: h.adapter });
    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'repeated-response',
      requests: 2,
      rounds: 1,
    });
    expect(h.apply).toHaveBeenCalledTimes(1);
  });

  test('finite failures back off and refresh the full summary before retrying', async () => {
    const h = harness(1);
    h.check
      .mockRejectedValueOnce(new OneKeyLocalError('synthetic offline'))
      .mockRejectedValueOnce(new OneKeyLocalError('synthetic offline'));
    expect(
      await runCloudSyncReconciliation({ adapter: h.adapter }),
    ).toMatchObject({ status: 'complete', requests: 3, failures: 2 });
    expect(h.pause.mock.calls.map(([value]) => value.delayMs)).toEqual([
      250, 500,
    ]);
    expect(h.getFullSummary.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  test('failure exhaustion remains resumable and does not spin', async () => {
    const h = harness();
    h.check.mockRejectedValue(new OneKeyLocalError('synthetic offline'));
    expect(
      await runCloudSyncReconciliation({ adapter: h.adapter }),
    ).toMatchObject({
      status: 'blocked',
      reason: 'retry-exhausted',
      requests: 3,
      failures: 3,
      unfinished: true,
    });
    expect(h.pause).toHaveBeenCalledTimes(2);
  });

  test('a partly applied failing batch is observed before a request-budget continuation', async () => {
    const h = harness(2);
    h.apply.mockImplementationOnce(async ({ response: batch }) => {
      const row = batch.diff[0];
      h.local.set(row.key, {
        key: row.key,
        dataTimestamp: row.dataTimestamp,
        dataType: row.dataType,
      });
      throw new OneKeyLocalError('synthetic second transaction failed');
    });
    const first = await runCloudSyncReconciliation({
      adapter: h.adapter,
      limits: { maxRequests: 1 },
    });
    expect(first).toMatchObject({
      status: 'waiting',
      reason: 'request-budget',
      progress: true,
      requests: 1,
      failures: 1,
    });
    const second = await runCloudSyncReconciliation({ adapter: h.adapter });
    expect(second).toMatchObject({ status: 'complete', received: 1 });
    expect(h.local.size).toBe(2);
  });

  test('acknowledged uploads are progress even when the local summary is unchanged', async () => {
    const h = harness();
    h.check.mockResolvedValueOnce(
      response({
        obsoleted: ['public-upload'],
        reconciliation: contract({ hasMore: true }),
      }),
    );
    expect(
      await runCloudSyncReconciliation({ adapter: h.adapter }),
    ).toMatchObject({
      status: 'complete',
      uploaded: 1,
      requests: 2,
      rounds: 2,
    });
    expect(h.uploadObsoleted).toHaveBeenCalledTimes(1);
  });

  test('the overall deadline also bounds an unresponsive local-summary adapter', async () => {
    jest.useFakeTimers();
    const h = harness();
    h.getFullSummary.mockImplementation(() => new Promise(() => undefined));
    const pending = runCloudSyncReconciliation({
      adapter: h.adapter,
      limits: { maxDurationMs: 20 },
    });
    await jest.advanceTimersByTimeAsync(20);
    expect(await pending).toMatchObject({
      status: 'blocked',
      reason: 'time-budget',
      requests: 0,
    });
    expect(h.check).not.toHaveBeenCalled();
  });

  test('cancellation during backoff prevents another request', async () => {
    const h = harness();
    const controller = new AbortController();
    h.check.mockRejectedValue(new OneKeyLocalError('synthetic offline'));
    h.pause.mockImplementation(async () => {
      controller.abort();
    });
    expect(
      await runCloudSyncReconciliation({
        adapter: h.adapter,
        signal: controller.signal,
      }),
    ).toMatchObject({ status: 'cancelled', reason: 'cancelled', requests: 1 });
    expect(h.check).toHaveBeenCalledTimes(1);
  });

  test('request timeout aborts the actual adapter signal before returning a bounded stop', async () => {
    jest.useFakeTimers();
    const h = harness();
    let abortedRequests = 0;
    h.check.mockImplementation(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              abortedRequests += 1;
              reject(new OneKeyLocalError('synthetic transport aborted'));
            },
            { once: true },
          );
        }),
    );
    const pending = runCloudSyncReconciliation({
      adapter: h.adapter,
      limits: { requestTimeoutMs: 20, maxDurationMs: 500, maxRetries: 0 },
    });
    await jest.advanceTimersByTimeAsync(20);
    expect(await pending).toMatchObject({
      status: 'blocked',
      reason: 'retry-exhausted',
      requests: 1,
      failures: 1,
    });
    expect(abortedRequests).toBe(1);
    expect(h.apply).not.toHaveBeenCalled();
  });

  test('a source switch after check discards the reply before DB or upload actions', async () => {
    const h = harness();
    h.check.mockImplementation(async () => {
      h.changeSource();
      return response({ diff: [record(0)], obsoleted: ['public-upload'] });
    });
    expect(
      await runCloudSyncReconciliation({ adapter: h.adapter }),
    ).toMatchObject({
      status: 'cancelled',
      reason: 'source-changed',
      requests: 1,
    });
    expect(h.apply).not.toHaveBeenCalled();
    expect(h.uploadObsoleted).not.toHaveBeenCalled();
  });

  test('an externally aborted pending request cannot apply a late reply', async () => {
    const h = harness();
    const controller = new AbortController();
    let resolveCheck: (value: ICloudSyncCheckServerStatusResult) => void = () =>
      undefined;
    let started: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    h.check.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
          started();
        }),
    );
    const pending = runCloudSyncReconciliation({
      adapter: h.adapter,
      signal: controller.signal,
    });
    await ready;
    controller.abort();
    expect((await pending).status).toBe('cancelled');
    resolveCheck(response({ diff: [record(0)] }));
    await Promise.resolve();
    expect(h.apply).not.toHaveBeenCalled();
  });

  test('ten thousand real public metadata rows have bounded serialization bytes, memory and time', () => {
    const summary: ICloudSyncReconciliationSummary = Array.from(
      { length: 10_000 },
      (_, index) => ({
        key: index.toString(16).padStart(128, '0'),
        dataTimestamp: 1_750_000_000_000 + index,
        dataType: EPrimeCloudSyncDataType.Account,
      }),
    );
    const heapBefore = process.memoryUsage().heapUsed;
    const startedAt = performance.now();
    const measured = measureCloudSyncReconciliationSummary(summary);
    const durationMs = performance.now() - startedAt;
    const heapDelta = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
    expect(measured.bytes).toBe(
      Buffer.byteLength(stringUtils.stableStringify(summary), 'utf8'),
    );
    expect(measured.bytes).toBeGreaterThan(1024 * 1024);
    expect(measured.bytes).toBeLessThan(8 * 1024 * 1024);
    expect(measured.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(durationMs).toBeLessThan(5000);
    expect(heapDelta).toBeLessThan(64 * 1024 * 1024);
    console.log('Synthetic Cloud summary benchmark', {
      rows: summary.length,
      bytes: measured.bytes,
      durationMs: Math.round(durationMs),
      heapDelta,
    });
  });

  test('oversized or ambiguous full summaries stop before issuing a request', async () => {
    const h = harness();
    h.local.set('a'.repeat(128), {
      key: 'a'.repeat(128),
      dataType: EPrimeCloudSyncDataType.Account,
      dataTimestamp: 1,
    });
    expect(
      await runCloudSyncReconciliation({
        adapter: h.adapter,
        limits: { maxSummaryBytes: 100 },
      }),
    ).toMatchObject({
      status: 'blocked',
      reason: 'summary-budget',
      requests: 0,
    });
    expect(h.check).not.toHaveBeenCalled();
    const duplicated = [
      h.local.values().next().value,
      h.local.values().next().value,
    ].filter((item): item is ICloudSyncReconciliationSummary[number] =>
      Boolean(item),
    );
    expect(() => measureCloudSyncReconciliationSummary(duplicated)).toThrow(
      'invalid-summary',
    );
  });

  test('summary ordering alone does not manufacture progress', () => {
    const summary: ICloudSyncReconciliationSummary = [0, 1].map((index) => ({
      key: String(index),
      dataType: EPrimeCloudSyncDataType.Account,
      dataTimestamp: index,
    }));
    expect(measureCloudSyncReconciliationSummary(summary)).toEqual(
      measureCloudSyncReconciliationSummary([...summary].toReversed()),
    );
  });
});
