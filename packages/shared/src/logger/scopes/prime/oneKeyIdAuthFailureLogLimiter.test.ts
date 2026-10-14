import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  ONEKEY_ID_AUTH_FAILURE_LOG_LIMITER_STORAGE_KEY,
  OneKeyIdAuthFailureLogLimiter,
  getOneKeyIdAuthFailureSignature,
} from './oneKeyIdAuthFailureLogLimiter';

import type {
  IOneKeyIdAuthFailureLogLimits,
  IOneKeyIdAuthFailureLogPayload,
} from './oneKeyIdAuthFailureLogLimiter';

/*
yarn jest packages/shared/src/logger/scopes/prime/oneKeyIdAuthFailureLogLimiter.test.ts
*/

const WINDOW_MS = 60 * 60 * 1000;
const LIMITS: IOneKeyIdAuthFailureLogLimits = {
  windowMs: WINDOW_MS,
  maxEventsPerSignature: { interactive: 3, passive: 1, unknown: 1 },
  maxEventsPerWindow: 5,
  maxTrackedSignatures: 3,
  persistIntervalMs: 1000,
};

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      values.delete(key);
    }),
  };
}

function createLimiter({
  storage = null,
  limits = LIMITS,
}: {
  storage?: ReturnType<typeof createMemoryStorage> | null;
  limits?: IOneKeyIdAuthFailureLogLimits;
} = {}) {
  const clock = { now: 1_000_000 };
  const limiter = new OneKeyIdAuthFailureLogLimiter({
    limits,
    storage,
    now: () => clock.now,
  });
  return { limiter, clock };
}

function payload(
  overrides: Partial<IOneKeyIdAuthFailureLogPayload> = {},
): IOneKeyIdAuthFailureLogPayload {
  return {
    source: 'throwSite',
    category: 'unknown',
    trigger: 'passive',
    reason: 'SupabaseAuthProvider session fetch failed: name=Error',
    ...overrides,
  };
}

function consume(
  limiter: OneKeyIdAuthFailureLogLimiter,
  item: IOneKeyIdAuthFailureLogPayload,
) {
  return limiter.consume({
    signature: getOneKeyIdAuthFailureSignature(item),
    payload: item,
  });
}

describe('getOneKeyIdAuthFailureSignature', () => {
  it('ignores request ids, uuids, ports and durations', () => {
    expect(
      getOneKeyIdAuthFailureSignature(
        payload({
          requestId: 'a',
          reason:
            'Desktop OAuth local server start failed on port 51234 after 10000ms requestId=req-1 session 3f8a1c92-7d4e-4b16-9c0a-5e2b7f13a840',
        }),
      ),
    ).toBe(
      getOneKeyIdAuthFailureSignature(
        payload({
          requestId: 'b',
          reason:
            'Desktop OAuth local server start failed on port 50011 after 12000ms requestId=req-2 session 0b6e3f4a-1111-4b16-9c0a-5e2b7f13a840',
        }),
      ),
    );
  });

  it('separates call sites, triggers and Desktop API calls', () => {
    const base = payload({
      errorName: 'UnwrappedIpcError',
      ipcModule: 'storage',
      ipcMethod: 'secureGetItemAsync',
    });
    const signatures = new Set([
      getOneKeyIdAuthFailureSignature(base),
      getOneKeyIdAuthFailureSignature({
        ...base,
        ipcMethod: 'secureSetItemAsync',
      }),
      getOneKeyIdAuthFailureSignature({ ...base, trigger: 'interactive' }),
      getOneKeyIdAuthFailureSignature({
        ...base,
        reason: 'SupabaseAuthProvider initial session fetch failed: name=Error',
      }),
      getOneKeyIdAuthFailureSignature({ ...base, httpStatusCode: 503 }),
    ]);
    expect(signatures.size).toBe(5);
  });
});

describe('OneKeyIdAuthFailureLogLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('reports the first passive occurrence and counts the repeats', () => {
    const { limiter, clock } = createLimiter();

    expect(consume(limiter, payload())).toEqual({
      shouldReport: true,
      summaries: [],
    });
    clock.now += 10;
    expect(consume(limiter, payload()).shouldReport).toBe(false);
    clock.now += 10;
    expect(consume(limiter, payload()).shouldReport).toBe(false);
    expect(limiter.getNextSummaryDueAt()).toBe(1_000_000 + WINDOW_MS);
  });

  it('lets a few interactive attempts through per window', () => {
    const { limiter } = createLimiter();
    const results = Array.from(
      { length: 5 },
      () => consume(limiter, payload({ trigger: 'interactive' })).shouldReport,
    );
    expect(results).toEqual([true, true, true, false, false]);
  });

  it('caps reports across signatures within a window', () => {
    const { limiter } = createLimiter({
      limits: { ...LIMITS, maxTrackedSignatures: 50 },
    });
    const results = Array.from(
      { length: 7 },
      (_, i) =>
        consume(limiter, payload({ reason: `failure ${'x'.repeat(i)}` }))
          .shouldReport,
    );
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });

  it('summarizes held-back repeats and reopens the window after it ends', () => {
    const { limiter, clock } = createLimiter();
    const first = payload({ requestId: 'req-first' });
    consume(limiter, first);
    clock.now += 1000;
    consume(limiter, payload({ requestId: 'req-2' }));
    clock.now += 5000;
    consume(limiter, payload({ requestId: 'req-3' }));

    clock.now = 1_000_000 + WINDOW_MS - 1;
    expect(limiter.takeDueSummaries()).toEqual([]);

    clock.now = 1_000_000 + WINDOW_MS;
    const { requestId: _requestId, ...summaryPayload } = first;
    expect(limiter.takeDueSummaries()).toEqual([
      {
        ...summaryPayload,
        repeatCount: 2,
        firstRepeatAt: 1_001_000,
        lastRepeatAt: 1_006_000,
      },
    ]);
    expect(limiter.getNextSummaryDueAt()).toBeUndefined();
    expect(consume(limiter, payload()).shouldReport).toBe(true);
  });

  it('returns ended windows with the next occurrence when no timer ran', () => {
    const { limiter, clock } = createLimiter();
    consume(limiter, payload());
    consume(limiter, payload());

    clock.now += WINDOW_MS;
    const result = consume(limiter, payload());
    expect(result.shouldReport).toBe(true);
    expect(result.summaries).toEqual([
      expect.objectContaining({ repeatCount: 1 }),
    ]);
  });

  it('ends the window when the clock moves backwards', () => {
    const { limiter, clock } = createLimiter();
    consume(limiter, payload());
    consume(limiter, payload());

    clock.now -= 60 * 1000;
    const result = consume(limiter, payload());
    expect(result.shouldReport).toBe(true);
    expect(result.summaries).toHaveLength(1);
  });

  it('summarizes the least recently seen signature when evicting it', () => {
    const { limiter, clock } = createLimiter();
    consume(limiter, payload({ reason: 'a' }));
    consume(limiter, payload({ reason: 'a' }));
    clock.now += 1;
    consume(limiter, payload({ reason: 'b' }));
    clock.now += 1;
    consume(limiter, payload({ reason: 'c' }));
    clock.now += 1;

    const result = consume(limiter, payload({ reason: 'd' }));
    expect(result.summaries).toEqual([
      expect.objectContaining({ reason: 'a', repeatCount: 1 }),
    ]);
  });

  it('keeps limiting after a renderer restart and reports the old repeats later', () => {
    const storage = createMemoryStorage();
    const first = createLimiter({ storage });
    consume(first.limiter, payload());
    first.clock.now += 1;
    consume(first.limiter, payload());
    // The throttled repeat count is written by the trailing write.
    first.clock.now += 1000;
    jest.advanceTimersByTime(1000);

    // A reloaded renderer builds a new limiter over the same web storage.
    const second = createLimiter({ storage });
    second.clock.now = first.clock.now + 60 * 1000;
    expect(consume(second.limiter, payload()).shouldReport).toBe(false);

    second.clock.now = 1_000_000 + WINDOW_MS;
    expect(second.limiter.takeDueSummaries()).toEqual([
      expect.objectContaining({ repeatCount: 2 }),
    ]);
  });

  it('writes suppressed-only updates at most once per interval', () => {
    const storage = createMemoryStorage();
    const { limiter, clock } = createLimiter({ storage });
    consume(limiter, payload());
    expect(storage.setItem).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 20; i += 1) {
      clock.now += 10;
      consume(limiter, payload());
    }
    expect(storage.setItem).toHaveBeenCalledTimes(1);

    // One trailing write carries all twenty repeats.
    clock.now += 1000;
    jest.advanceTimersByTime(1000);
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    const persisted = JSON.parse(
      storage.values.get(ONEKEY_ID_AUTH_FAILURE_LOG_LIMITER_STORAGE_KEY) ?? '',
    ) as { signatures: Record<string, { repeatCount: number }> };
    expect(Object.values(persisted.signatures)[0]?.repeatCount).toBe(20);

    clock.now += 1000;
    consume(limiter, payload());
    expect(storage.setItem).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(1000);
    expect(storage.setItem).toHaveBeenCalledTimes(3);
  });

  it('ignores unreadable or malformed persisted state', () => {
    const storage = createMemoryStorage();
    storage.values.set(
      ONEKEY_ID_AUTH_FAILURE_LOG_LIMITER_STORAGE_KEY,
      '{not json',
    );
    expect(
      consume(createLimiter({ storage }).limiter, payload()).shouldReport,
    ).toBe(true);

    storage.values.set(
      ONEKEY_ID_AUTH_FAILURE_LOG_LIMITER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        reportedCount: 'many',
        signatures: {
          [getOneKeyIdAuthFailureSignature(payload())]: { reportedCount: 9 },
        },
      }),
    );
    expect(
      consume(createLimiter({ storage }).limiter, payload()).shouldReport,
    ).toBe(true);
  });

  it('keeps working when storage throws', () => {
    const storage = createMemoryStorage();
    storage.getItem.mockImplementation(() => {
      throw new OneKeyLocalError('SecurityError');
    });
    storage.setItem.mockImplementation(() => {
      throw new OneKeyLocalError('QuotaExceededError');
    });
    const { limiter } = createLimiter({ storage });

    expect(consume(limiter, payload()).shouldReport).toBe(true);
    expect(consume(limiter, payload()).shouldReport).toBe(false);
  });
});
