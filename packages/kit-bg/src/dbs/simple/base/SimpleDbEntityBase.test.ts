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

  // Unreadable until removeItem drops it, mirroring a corrupted blob record.
  const makeBrokenStorage = (errorName: string) => {
    const store: Record<string, unknown> = {};
    const calls: string[] = [];
    let broken = true;
    return {
      store,
      calls,
      storage: {
        getItem: async (k: string) => {
          calls.push('getItem');
          if (broken) {
            const error = new Error('Failed to read large IndexedDB value');
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
          broken = false;
        },
      },
    };
  };

  test('getRawData drops the unreadable record and returns null', async () => {
    const entity = new HealTestEntity();
    const { storage, calls } = makeBrokenStorage('UnknownError');
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).resolves.toBeNull();
    expect(calls).toEqual(['getItem', 'removeItem']);
  });

  test('setRawData(builder) rebuilds the record after a read failure', async () => {
    const entity = new HealTestEntity();
    const { storage, store } = makeBrokenStorage('NotReadableError');
    (entity as any).appStorage = storage;

    await expect(
      entity.setRawData((prev) => ({ v: (prev?.v ?? 0) + 1 })),
    ).resolves.toEqual({ v: 1 });
    expect(entity.entityKey in store).toBe(true);
    await expect(entity.getRawData()).resolves.toEqual({ v: 1 });
  });

  test('non-storage read errors still propagate without deleting the record', async () => {
    const entity = new HealTestEntity();
    const { storage, calls } = makeBrokenStorage('SomeRandomError');
    (entity as any).appStorage = storage;

    await expect(entity.getRawData()).rejects.toThrow(
      'Failed to read large IndexedDB value',
    );
    expect(calls).toEqual(['getItem']);
  });
});
