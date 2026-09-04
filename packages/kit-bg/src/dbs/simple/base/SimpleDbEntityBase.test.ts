import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';

import {
  UNREADABLE_SELF_HEAL_MAX_RETRIES,
  getUnreadableSelfHealDelayMs,
} from './retryUnreadableStorageRead';
import { SimpleDbEntityBase } from './SimpleDbEntityBase';

/*
yarn jest packages/kit-bg/src/dbs/simple/base/SimpleDbEntityBase.test.ts
*/

jest.mock('@onekeyhq/shared/src/utils/promiseUtils', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/utils/promiseUtils',
  ) as typeof import('@onekeyhq/shared/src/utils/promiseUtils');
  return {
    ...actual,
    waitAsync: jest.fn(async () => undefined),
  };
});

const waitAsyncMock = waitAsync as jest.MockedFunction<typeof waitAsync>;

// Single configurable entity over controllable in-memory appStorage mocks —
// oxlint allows one class per file, so cache/self-heal variants are options.
class TestEntity extends SimpleDbEntityBase<{ v: number }> {
  override readonly entityName: string;

  override readonly enableCache: boolean;

  protected override readonly enableUnreadableRecordSelfHeal: boolean;

  constructor({
    name = 'test-entity',
    enableCache = false,
    selfHeal = true,
  }: { name?: string; enableCache?: boolean; selfHeal?: boolean } = {}) {
    super();
    this.entityName = name;
    this.enableCache = enableCache;
    this.enableUnreadableRecordSelfHeal = selfHeal;
  }

  async runTransaction({
    afterPublish,
    beforePublish,
    build,
    shouldCommit,
  }: {
    afterPublish?: (data: { v: number }) => boolean;
    beforePublish?: (data: { v: number }) => Promise<boolean> | boolean;
    build: (
      rawData: { v: number } | null | undefined,
    ) => Promise<{ data: { v: number } } | undefined>;
    shouldCommit: () => boolean;
  }) {
    return this.setRawDataTransaction({
      afterPublish,
      beforePublish,
      build,
      shouldCommit,
    });
  }
}

const expectedHealGetItemCalls = 1 + UNREADABLE_SELF_HEAL_MAX_RETRIES;

describe('SimpleDbEntityBase clear/set mutex serialization', () => {
  test('clearRawData cannot interleave with an in-flight setRawData', async () => {
    const entity = new TestEntity();
    const store: Record<string, unknown> = {};
    const order: string[] = [];

    let releaseBuilder!: () => void;
    const builderGate = new Promise<void>((resolve) => {
      releaseBuilder = resolve;
    });
    let signalInBuilder!: () => void;
    const builderReached = new Promise<void>((resolve) => {
      signalInBuilder = resolve;
    });

    (entity as any).appStorage = {
      getItem: async (k: string) => (k in store ? store[k] : null),
      setItem: async (k: string, v: unknown) => {
        store[k] = v;
        order.push('setItem');
      },
      removeItem: async (k: string) => {
        delete store[k];
        order.push('removeItem');
      },
    };

    // setRawData acquires the mutex, then parks inside the builder.
    const setP = entity.setRawData(async () => {
      signalInBuilder();
      await builderGate;
      return { v: 1 };
    });
    await builderReached; // setRawData now holds the mutex

    // Fire clearRawData while the mutex is held. With the fix it must queue behind
    // the mutex; without it, removeItem() would fire here immediately and the
    // later setItem() would resurrect the cleared cache.
    const clearP = entity.clearRawData();
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([]); // clear is blocked — nothing written or removed yet

    releaseBuilder(); // let setRawData finish; clearRawData runs strictly after it
    await Promise.all([setP, clearP]);

    expect(order).toEqual(['setItem', 'removeItem']); // serialized, clear last
    expect(entity.entityKey in store).toBe(false); // cache stays cleared
  });
});

describe('SimpleDbEntityBase guarded transaction visibility', () => {
  const readStoredData = (value: unknown) => {
    const saved =
      typeof value === 'string'
        ? (JSON.parse(value) as { data: { v: number } })
        : (value as { data: { v: number } });
    return saved.data;
  };

  test('keeps the old snapshot visible and restores storage when the guard becomes stale', async () => {
    const entity = new TestEntity({ enableCache: true });
    const store: Record<string, unknown> = {};
    let transactionWriteCount = 0;
    let signalTransactionWrite!: () => void;
    const transactionWriteStarted = new Promise<void>((resolve) => {
      signalTransactionWrite = resolve;
    });
    let releaseTransactionWrite!: () => void;
    const transactionWriteGate = new Promise<void>((resolve) => {
      releaseTransactionWrite = resolve;
    });
    let transactionActive = false;
    (entity as any).appStorage = {
      getItem: async (key: string) => (key in store ? store[key] : null),
      setItem: async (key: string, value: unknown) => {
        store[key] = value;
        if (transactionActive && transactionWriteCount === 0) {
          transactionWriteCount += 1;
          signalTransactionWrite();
          await transactionWriteGate;
        }
      },
      removeItem: async (key: string) => {
        delete store[key];
      },
    };
    await entity.setRawData({ v: 1 });

    let current = true;
    transactionActive = true;
    const transaction = entity.runTransaction({
      build: async () => ({ data: { v: 2 } }),
      shouldCommit: () => current,
    });
    await transactionWriteStarted;

    expect(readStoredData(store[entity.entityKey])).toEqual({ v: 2 });
    await expect(entity.getRawData()).resolves.toEqual({ v: 1 });

    current = false;
    releaseTransactionWrite();
    await expect(transaction).resolves.toMatchObject({ committed: false });
    await expect(entity.getRawData()).resolves.toEqual({ v: 1 });
    expect(readStoredData(store[entity.entityKey])).toEqual({ v: 1 });
  });

  test('publishes the new cache only after persistence and the final guard pass', async () => {
    const entity = new TestEntity({ enableCache: true });
    const store: Record<string, unknown> = {};
    let signalTransactionWrite!: () => void;
    const transactionWriteStarted = new Promise<void>((resolve) => {
      signalTransactionWrite = resolve;
    });
    let releaseTransactionWrite!: () => void;
    const transactionWriteGate = new Promise<void>((resolve) => {
      releaseTransactionWrite = resolve;
    });
    let transactionActive = false;
    (entity as any).appStorage = {
      getItem: async (key: string) => (key in store ? store[key] : null),
      setItem: async (key: string, value: unknown) => {
        store[key] = value;
        if (transactionActive) {
          signalTransactionWrite();
          await transactionWriteGate;
        }
      },
      removeItem: async (key: string) => {
        delete store[key];
      },
    };
    await entity.setRawData({ v: 1 });

    transactionActive = true;
    const transaction = entity.runTransaction({
      build: async () => ({ data: { v: 2 } }),
      shouldCommit: () => true,
    });
    await transactionWriteStarted;
    await expect(entity.getRawData()).resolves.toEqual({ v: 1 });

    transactionActive = false;
    releaseTransactionWrite();
    await expect(transaction).resolves.toMatchObject({ committed: true });
    await expect(entity.getRawData()).resolves.toEqual({ v: 2 });
    expect(readStoredData(store[entity.entityKey])).toEqual({ v: 2 });
  });

  test('restores storage and cache when the synchronous publish finalizer rejects', async () => {
    const entity = new TestEntity({ enableCache: true });
    const store: Record<string, unknown> = {};
    (entity as any).appStorage = {
      getItem: async (key: string) => (key in store ? store[key] : null),
      setItem: async (key: string, value: unknown) => {
        store[key] = value;
      },
      removeItem: async (key: string) => {
        delete store[key];
      },
    };
    await entity.setRawData({ v: 1 });

    await expect(
      entity.runTransaction({
        afterPublish: (data) => {
          expect(data).toEqual({ v: 2 });
          expect(entity.cachedRawData).toEqual({ v: 2 });
          return false;
        },
        build: async () => ({ data: { v: 2 } }),
        shouldCommit: () => true,
      }),
    ).resolves.toMatchObject({ committed: false });

    await expect(entity.getRawData()).resolves.toEqual({ v: 1 });
    expect(readStoredData(store[entity.entityKey])).toEqual({ v: 1 });
  });

  test('restores storage and cache when the pre-publish finalizer throws', async () => {
    const entity = new TestEntity({ enableCache: true });
    const store: Record<string, unknown> = {};
    (entity as any).appStorage = {
      getItem: async (key: string) => (key in store ? store[key] : null),
      setItem: async (key: string, value: unknown) => {
        store[key] = value;
      },
      removeItem: async (key: string) => {
        delete store[key];
      },
    };
    await entity.setRawData({ v: 1 });

    await expect(
      entity.runTransaction({
        beforePublish: async () => {
          await expect(entity.getRawData()).resolves.toEqual({ v: 1 });
          throw new OneKeyLocalError('finalizer failed');
        },
        build: async () => ({ data: { v: 2 } }),
        shouldCommit: () => true,
      }),
    ).rejects.toThrow('finalizer failed');

    await expect(entity.getRawData()).resolves.toEqual({ v: 1 });
    expect(readStoredData(store[entity.entityKey])).toEqual({ v: 1 });
  });

  test('retries a failed guarded rollback instead of leaving rejected data on disk', async () => {
    const entity = new TestEntity({ enableCache: true });
    const store: Record<string, unknown> = {};
    let rollbackAttemptCount = 0;
    let transactionStarted = false;
    (entity as any).appStorage = {
      getItem: async (key: string) => (key in store ? store[key] : null),
      setItem: async (key: string, value: unknown) => {
        if (transactionStarted && readStoredData(value).v === 1) {
          rollbackAttemptCount += 1;
          if (rollbackAttemptCount === 1) {
            throw new OneKeyLocalError('transient rollback failure');
          }
        }
        store[key] = value;
      },
      removeItem: async (key: string) => {
        delete store[key];
      },
    };
    await entity.setRawData({ v: 1 });
    transactionStarted = true;
    let guardCheckCount = 0;

    await expect(
      entity.runTransaction({
        build: async () => ({ data: { v: 2 } }),
        shouldCommit: () => {
          guardCheckCount += 1;
          return guardCheckCount === 1;
        },
      }),
    ).resolves.toMatchObject({ committed: false });

    expect(rollbackAttemptCount).toBe(2);
    await expect(entity.getRawData()).resolves.toEqual({ v: 1 });
    expect(readStoredData(store[entity.entityKey])).toEqual({ v: 1 });
  });

  test('drops the rollback cache when both restore attempts fail', async () => {
    const entity = new TestEntity({ enableCache: true });
    const store: Record<string, unknown> = {};
    let rollbackAttemptCount = 0;
    let transactionStarted = false;
    (entity as any).appStorage = {
      getItem: async (key: string) => (key in store ? store[key] : null),
      setItem: async (key: string, value: unknown) => {
        if (transactionStarted && readStoredData(value).v === 1) {
          rollbackAttemptCount += 1;
          throw new OneKeyLocalError('persistent rollback failure');
        }
        store[key] = value;
      },
      removeItem: async (key: string) => {
        delete store[key];
      },
    };
    await entity.setRawData({ v: 1 });
    transactionStarted = true;
    let guardCheckCount = 0;

    const transaction = entity.runTransaction({
      build: async () => ({ data: { v: 2 } }),
      shouldCommit: () => {
        guardCheckCount += 1;
        return guardCheckCount === 1;
      },
    });

    await expect(transaction).rejects.toThrow(
      'Failed to restore SimpleDB data after retry: persistent rollback failure',
    );
    await expect(transaction).rejects.toMatchObject({
      cause: {
        firstRestoreError: expect.objectContaining({
          message: 'persistent rollback failure',
        }),
        retryError: expect.objectContaining({
          message: 'persistent rollback failure',
        }),
      },
    });

    expect(rollbackAttemptCount).toBe(2);
    expect(readStoredData(store[entity.entityKey])).toEqual({ v: 2 });
    await expect(entity.getRawData()).resolves.toEqual({ v: 2 });
  });

  test('restores a persisted value whose legacy timestamp is zero', async () => {
    const entity = new TestEntity({ enableCache: true });
    const store: Record<string, unknown> = {
      [entity.entityKey]: JSON.stringify({ data: { v: 1 }, updatedAt: 0 }),
    };
    const removeItem = jest.fn(async (key: string) => {
      delete store[key];
    });
    (entity as any).appStorage = {
      getItem: async (key: string) => (key in store ? store[key] : null),
      setItem: async (key: string, value: unknown) => {
        store[key] = value;
      },
      removeItem,
    };
    await expect(entity.getRawData()).resolves.toEqual({ v: 1 });
    let guardCheckCount = 0;

    await expect(
      entity.runTransaction({
        build: async () => ({ data: { v: 2 } }),
        shouldCommit: () => {
          guardCheckCount += 1;
          return guardCheckCount === 1;
        },
      }),
    ).resolves.toMatchObject({ committed: false });

    expect(removeItem).not.toHaveBeenCalled();
    expect(readStoredData(store[entity.entityKey])).toEqual({ v: 1 });
  });
});

// A corrupted external blob makes every read reject forever, and builder-based
// setRawData reads first — without self-heal the record could never be repaired.
describe('SimpleDbEntityBase unreadable-record self-heal', () => {
  beforeEach(() => {
    waitAsyncMock.mockClear();
    waitAsyncMock.mockImplementation(async () => undefined);
  });

  const makeHealEntity = () =>
    new TestEntity({ name: 'test-heal-entity', selfHeal: true });

  // Unreadable until removeItem drops it (or failTimes runs out), mirroring a
  // corrupted blob record vs a transient IO failure.
  const makeBrokenStorage = ({
    errorName,
    errorMessage = 'Failed to read large IndexedDB value',
    failTimes = Number.POSITIVE_INFINITY,
  }: {
    errorName: string;
    errorMessage?: string;
    failTimes?: number;
  }) => {
    const store: Record<string, unknown> = {};
    const calls: string[] = [];
    let remainingFails = failTimes;
    return {
      store,
      calls,
      storage: {
        getItem: async (k: string) => {
          calls.push('getItem');
          if (remainingFails > 0) {
            remainingFails -= 1;
            const error = new Error(errorMessage);
            error.name = errorName;
            throw error;
          }
          return (k in store ? store[k] : null) as string | null;
        },
        setItem: async (k: string, v: unknown) => {
          calls.push('setItem');
          store[k] = v;
        },
        removeItem: async (k: string) => {
          calls.push('removeItem');
          delete store[k];
          remainingFails = 0;
        },
      },
    };
  };

  test('getRawData drops the unreadable record after exponential-backoff retries', async () => {
    const entity = makeHealEntity();
    const { storage, calls } = makeBrokenStorage({ errorName: 'UnknownError' });
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).resolves.toBeNull();
    expect(calls).toEqual([
      ...Array(expectedHealGetItemCalls).fill('getItem'),
      'removeItem',
    ]);
    expect(waitAsyncMock.mock.calls.map((c) => c[0])).toEqual(
      Array.from({ length: UNREADABLE_SELF_HEAL_MAX_RETRIES }, (_, i) =>
        getUnreadableSelfHealDelayMs(i),
      ),
    );
  });

  test('setRawData(builder) rebuilds the record after a read failure', async () => {
    const entity = makeHealEntity();
    const { storage, store } = makeBrokenStorage({
      errorName: 'UnknownError',
    });
    (entity as any).appStorage = storage;

    await expect(
      entity.setRawData((prev) => ({ v: (prev?.v ?? 0) + 1 })),
    ).resolves.toEqual({ v: 1 });
    expect(entity.entityKey in store).toBe(true);
    await expect(entity.getRawData()).resolves.toEqual({ v: 1 });
  });

  test('non-storage read errors still propagate without deleting the record', async () => {
    const entity = makeHealEntity();
    const { storage, calls } = makeBrokenStorage({
      errorName: 'SomeRandomError',
    });
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).rejects.toThrow(
      'Failed to read large IndexedDB value',
    );
    expect(calls).toEqual(['getItem']);
    expect(waitAsyncMock).not.toHaveBeenCalled();
  });

  test('NotReadableError propagates without deleting (transient IO condition)', async () => {
    const entity = makeHealEntity();
    const { storage, calls } = makeBrokenStorage({
      errorName: 'NotReadableError',
    });
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).rejects.toThrow(
      'Failed to read large IndexedDB value',
    );
    expect(calls).toEqual(['getItem']);
  });

  test('UnknownError without the corrupted-blob message propagates without deleting', async () => {
    const entity = makeHealEntity();
    const { storage, calls } = makeBrokenStorage({
      errorName: 'UnknownError',
      errorMessage: 'Internal error opening backing store',
    });
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).rejects.toThrow(
      'Internal error opening backing store',
    );
    expect(calls).toEqual(['getItem']);
  });

  test('UnknownError whose message includes the corrupted-blob fragment self-heals', async () => {
    const entity = makeHealEntity();
    const { storage, calls } = makeBrokenStorage({
      errorName: 'UnknownError',
      errorMessage: 'Failed to read large IndexedDB value (disk full)',
    });
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).resolves.toBeNull();
    expect(calls).toEqual([
      ...Array(expectedHealGetItemCalls).fill('getItem'),
      'removeItem',
    ]);
  });

  test('a transient read failure recovers via retry and keeps the record', async () => {
    const entity = makeHealEntity();
    const { storage, store, calls } = makeBrokenStorage({
      errorName: 'UnknownError',
      failTimes: 1,
    });
    store[entity.entityKey] = JSON.stringify({ data: { v: 9 }, updatedAt: 1 });
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).resolves.toEqual({ v: 9 });
    expect(calls).toEqual(['getItem', 'getItem']);
    expect(entity.entityKey in store).toBe(true);
    expect(waitAsyncMock).toHaveBeenCalledTimes(1);
    expect(waitAsyncMock).toHaveBeenCalledWith(getUnreadableSelfHealDelayMs(0));
  });

  test('self-heal delete is skipped when a write lands during the failing read', async () => {
    const entity = makeHealEntity();
    const store: Record<string, unknown> = {};
    const calls: string[] = [];
    let rejectFirstRead!: (error: Error) => void;
    let readCount = 0;
    const makeError = () => {
      const error = new Error('Failed to read large IndexedDB value');
      error.name = 'UnknownError';
      return error;
    };
    (entity as any).appStorage = {
      getItem: () => {
        readCount += 1;
        calls.push('getItem');
        if (readCount === 1) {
          return new Promise<string | null>((_, reject) => {
            rejectFirstRead = reject;
          });
        }
        return Promise.reject(makeError());
      },
      setItem: async (k: string, v: unknown) => {
        calls.push('setItem');
        store[k] = v;
      },
      removeItem: async (k: string) => {
        calls.push('removeItem');
        delete store[k];
      },
    };

    const readP = entity.getRawData(); // parked on the hanging first getItem
    await entity.setRawData({ v: 7 }); // write lands while the read is in flight
    rejectFirstRead(makeError());

    await expect(readP).resolves.toBeNull();
    expect(calls).not.toContain('removeItem'); // guard kept the fresh write
    expect(entity.entityKey in store).toBe(true);
  });

  test('self-heal delete is skipped while a write is still in flight', async () => {
    const entity = makeHealEntity();
    const store: Record<string, unknown> = {};
    const calls: string[] = [];
    let releaseWrite!: () => void;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let signalWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      signalWriteStarted = resolve;
    });
    const makeError = () => {
      const error = new Error('Failed to read large IndexedDB value');
      error.name = 'UnknownError';
      return error;
    };
    (entity as any).appStorage = {
      getItem: () => {
        calls.push('getItem');
        return Promise.reject(makeError());
      },
      setItem: async (k: string, v: unknown) => {
        calls.push('setItem');
        signalWriteStarted();
        await writeGate; // parked mid-write while the failing read races it
        store[k] = v;
      },
      removeItem: async (k: string) => {
        calls.push('removeItem');
        delete store[k];
      },
    };

    const writeP = entity.setRawData({ v: 7 }); // non-builder: no read involved
    await writeStarted; // setRawData is parked inside setItem, seq bumped
    const readP = entity.getRawData(); // fails while the write is in flight

    await expect(readP).resolves.toBeNull();
    releaseWrite();
    await writeP;

    expect(calls).not.toContain('removeItem'); // in-flight write already vetoed
    expect(entity.entityKey in store).toBe(true);
  });

  test('entities that opt out propagate the corrupted-blob error and keep the record', async () => {
    const entity = new TestEntity({
      name: 'test-no-heal-entity',
      selfHeal: false,
    });
    const { storage, calls } = makeBrokenStorage({ errorName: 'UnknownError' });
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).rejects.toThrow(
      'Failed to read large IndexedDB value',
    );
    expect(calls).toEqual(['getItem']); // no retry, no delete
  });

  test('delete is skipped when a pre-existing write completes during the failing read', async () => {
    const entity = makeHealEntity();
    const store: Record<string, unknown> = {};
    const calls: string[] = [];
    let releaseWrite!: () => void;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let signalWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      signalWriteStarted = resolve;
    });
    let rejectFirstRead!: (error: Error) => void;
    let readCount = 0;
    const makeError = () => {
      const error = new Error('Failed to read large IndexedDB value');
      error.name = 'UnknownError';
      return error;
    };
    (entity as any).appStorage = {
      getItem: () => {
        readCount += 1;
        calls.push('getItem');
        if (readCount === 1) {
          return new Promise<string | null>((_, reject) => {
            rejectFirstRead = reject;
          });
        }
        return Promise.reject(makeError());
      },
      setItem: async (k: string, v: unknown) => {
        calls.push('setItem');
        signalWriteStarted();
        await writeGate;
        store[k] = v;
      },
      removeItem: async (k: string) => {
        calls.push('removeItem');
        delete store[k];
      },
    };

    const writeP = entity.setRawData({ v: 7 });
    await writeStarted; // write is in flight before the read begins
    const readP = entity.getRawData(); // snapshot sees the pending write
    releaseWrite();
    await writeP; // write fully lands while the read is still failing
    rejectFirstRead(makeError());

    await expect(readP).resolves.toBeNull();
    expect(calls).not.toContain('removeItem'); // snapshot veto kept the value
    expect(entity.entityKey in store).toBe(true);
  });

  test('clearRawData during an in-flight read keeps the stale value out of the cache', async () => {
    const entity = new TestEntity({
      name: 'test-cached-heal-entity',
      enableCache: true,
    });
    const store: Record<string, unknown> = {};
    let resolveFirstRead!: (value: string) => void;
    let readCount = 0;
    (entity as any).appStorage = {
      getItem: (k: string) => {
        readCount += 1;
        if (readCount === 1) {
          return new Promise<string | null>((resolve) => {
            resolveFirstRead = resolve;
          });
        }
        return Promise.resolve((k in store ? store[k] : null) as string | null);
      },
      setItem: async (k: string, v: unknown) => {
        store[k] = v;
      },
      removeItem: async (k: string) => {
        delete store[k];
      },
    };

    const staleReadP = entity.getRawData(); // parked reading the old record
    await entity.clearRawData(); // user clears while the read is in flight
    resolveFirstRead(JSON.stringify({ data: { v: 9 }, updatedAt: 1 }));
    await expect(staleReadP).resolves.toEqual({ v: 9 }); // its caller still gets the old value

    // The stale value must not have been cached — a fresh read sees the clear.
    await expect(entity.getRawData()).resolves.toBeNull();
  });

  test('a slow read finishing after a save cannot revert the cached value', async () => {
    const entity = new TestEntity({
      name: 'test-cached-save-entity',
      enableCache: true,
    });
    const store: Record<string, unknown> = {};
    let resolveFirstRead!: (value: string) => void;
    let readCount = 0;
    (entity as any).appStorage = {
      getItem: (k: string) => {
        readCount += 1;
        if (readCount === 1) {
          return new Promise<string | null>((resolve) => {
            resolveFirstRead = resolve;
          });
        }
        return Promise.resolve((k in store ? store[k] : null) as string | null);
      },
      setItem: async (k: string, v: unknown) => {
        store[k] = v;
      },
      removeItem: async (k: string) => {
        delete store[k];
      },
    };

    const slowReadP = entity.getRawData(); // parked reading the old record
    await entity.setRawData({ v: 7 }); // save lands while the read is parked
    resolveFirstRead(JSON.stringify({ data: { v: 1 }, updatedAt: 1 }));
    await slowReadP; // the old value must not overwrite the cache

    await expect(entity.getRawData()).resolves.toEqual({ v: 7 });
  });
});
