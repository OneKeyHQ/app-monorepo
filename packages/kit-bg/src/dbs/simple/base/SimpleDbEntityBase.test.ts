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
