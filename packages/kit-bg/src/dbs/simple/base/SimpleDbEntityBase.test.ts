import { SimpleDbEntityBase } from './SimpleDbEntityBase';

/*
yarn jest packages/kit-bg/src/dbs/simple/base/SimpleDbEntityBase.test.ts
*/

// Concrete entity over a controllable in-memory appStorage so we can park a
// setRawData mid-flight (inside the mutex) and fire clearRawData concurrently.
// This proves clearRawData and setRawData are serialized by the shared mutex, so
// an in-flight write can never resurrect a just-cleared cache.
class TestEntity extends SimpleDbEntityBase<{ v: number }> {
  override readonly entityName = 'test-entity';

  override readonly enableCache = false;
}

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

// A corrupted external blob makes every read reject forever, and builder-based
// setRawData reads first — without self-heal the record could never be repaired.
describe('SimpleDbEntityBase unreadable-record self-heal', () => {
  class HealTestEntity extends SimpleDbEntityBase<{ v: number }> {
    override readonly entityName = 'test-heal-entity';

    override readonly enableCache = false;
  }

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
    let failed = 0;
    return {
      store,
      calls,
      storage: {
        getItem: async (k: string) => {
          calls.push('getItem');
          if (failed < failTimes) {
            failed += 1;
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
          failTimes = 0;
        },
      },
    };
  };

  test('getRawData drops the unreadable record and returns null', async () => {
    const entity = new HealTestEntity();
    const { storage, calls } = makeBrokenStorage({ errorName: 'UnknownError' });
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).resolves.toBeNull();
    expect(calls).toEqual(['getItem', 'getItem', 'removeItem']);
  });

  test('setRawData(builder) rebuilds the record after a read failure', async () => {
    const entity = new HealTestEntity();
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
    const entity = new HealTestEntity();
    const { storage, calls } = makeBrokenStorage({
      errorName: 'SomeRandomError',
    });
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).rejects.toThrow(
      'Failed to read large IndexedDB value',
    );
    expect(calls).toEqual(['getItem']);
  });

  test('NotReadableError propagates without deleting (transient IO condition)', async () => {
    const entity = new HealTestEntity();
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
    const entity = new HealTestEntity();
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

  test('a transient read failure recovers via retry and keeps the record', async () => {
    const entity = new HealTestEntity();
    const { storage, store, calls } = makeBrokenStorage({
      errorName: 'UnknownError',
      failTimes: 1,
    });
    store[entity.entityKey] = JSON.stringify({ data: { v: 9 }, updatedAt: 1 });
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).resolves.toEqual({ v: 9 });
    expect(calls).toEqual(['getItem', 'getItem']);
    expect(entity.entityKey in store).toBe(true);
  });

  test('self-heal delete is skipped when a write lands during the failing read', async () => {
    const entity = new HealTestEntity();
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
      getItem: (k: string) => {
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
    const entity = new HealTestEntity();
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
});
