import {
  PerKeyMutationQueue,
  executeOrderBookSubscriptionTransition,
  executeSubscriptionTasksWithOrderBookPriority,
} from './SubscriptionMutationQueue';

describe('PerKeyMutationQueue', () => {
  it('keeps tasks for the same key in order', async () => {
    const queue = new PerKeyMutationQueue();
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue('order-book', async () => {
      events.push('first:start');
      await firstBlocked;
      events.push('first:end');
    });
    const second = queue.enqueue('order-book', async () => {
      events.push('second');
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(events).toEqual(['first:start', 'first:end', 'second']);
  });
});

describe('executeOrderBookSubscriptionTransition', () => {
  type ITestSpec = { key: string; coin: string };
  const getConflictKey = (spec: ITestSpec) => spec.coin;

  it('subscribes the new target before unsubscribing the old one when coins differ', async () => {
    const events: string[] = [];

    const result = await executeOrderBookSubscriptionTransition({
      toDestroy: [{ key: 'l2:BTC', coin: 'BTC' }],
      toCreate: [{ key: 'l2:ETH', coin: 'ETH' }],
      destroy: async (spec) => {
        events.push(`destroy:${spec.key}`);
        return true;
      },
      create: async (spec) => {
        events.push(`create:${spec.key}`);
      },
      isPending: () => true,
      getConflictKey,
      runExclusive: (task) => task(),
      reconnect: () => Promise.resolve(),
    });

    expect(result).toBe(true);
    expect(events).toEqual(['create:l2:ETH', 'destroy:l2:BTC']);
  });

  it('still reconnects when the old unsubscribe fails after the new target is live', async () => {
    const create = jest.fn<Promise<void>, [ITestSpec]>(() => Promise.resolve());
    const reconnect = jest.fn<Promise<void>, []>(() => Promise.resolve());

    const result = await executeOrderBookSubscriptionTransition({
      toDestroy: [{ key: 'l2:BTC', coin: 'BTC' }],
      toCreate: [{ key: 'l2:ETH', coin: 'ETH' }],
      destroy: () => Promise.resolve(false),
      create,
      isPending: () => true,
      getConflictKey,
      runExclusive: (task) => task(),
      reconnect,
    });

    expect(result).toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps destroy-first order for same-coin grouping changes', async () => {
    const events: string[] = [];

    const result = await executeOrderBookSubscriptionTransition({
      toDestroy: [{ key: 'l2:BTC:sig2', coin: 'BTC' }],
      toCreate: [{ key: 'l2:BTC:sig5', coin: 'BTC' }],
      destroy: async (spec) => {
        events.push(`destroy:${spec.key}`);
        return true;
      },
      create: async (spec) => {
        events.push(`create:${spec.key}`);
      },
      isPending: () => true,
      getConflictKey,
      runExclusive: (task) => task(),
      reconnect: () => Promise.resolve(),
    });

    expect(result).toBe(true);
    expect(events).toEqual(['destroy:l2:BTC:sig2', 'create:l2:BTC:sig5']);
  });

  it('keeps destroy-first order and skips creation on failure for overlapping targets', async () => {
    const reconnect = jest.fn<Promise<void>, []>(() => Promise.resolve());
    const create = jest.fn<Promise<void>, [ITestSpec]>(() => Promise.resolve());

    const failedResult = await executeOrderBookSubscriptionTransition({
      toDestroy: [{ key: 'l2:BTC', coin: 'BTC' }],
      toCreate: [{ key: 'l2:BTC', coin: 'BTC' }],
      destroy: () => Promise.resolve(false),
      create,
      isPending: () => true,
      getConflictKey,
      runExclusive: (task) => task(),
      reconnect,
    });

    expect(failedResult).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it('skips creation for specs that are no longer pending', async () => {
    const create = jest.fn<Promise<void>, [ITestSpec]>(() => Promise.resolve());

    const result = await executeOrderBookSubscriptionTransition({
      toDestroy: [{ key: 'l2:BTC', coin: 'BTC' }],
      toCreate: [{ key: 'l2:ETH', coin: 'ETH' }],
      destroy: () => Promise.resolve(true),
      create,
      isPending: () => false,
      getConflictKey,
      runExclusive: (task) => task(),
      reconnect: () => Promise.resolve(),
    });

    expect(result).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('executeSubscriptionTasksWithOrderBookPriority', () => {
  it('starts the order book request first without blocking other requests', async () => {
    const events: string[] = [];
    let releaseOrderBook: (() => void) | undefined;
    const orderBookBlocked = new Promise<void>((resolve) => {
      releaseOrderBook = resolve;
    });

    const task = executeSubscriptionTasksWithOrderBookPriority({
      orderBookTask: async () => {
        events.push('orderBook:start');
        await orderBookBlocked;
        events.push('orderBook:end');
      },
      otherTasks: [
        async () => {
          events.push('other');
        },
      ],
    });

    await Promise.resolve();
    expect(events).toEqual(['orderBook:start', 'other']);

    releaseOrderBook?.();
    await task;
    expect(events).toEqual(['orderBook:start', 'other', 'orderBook:end']);
  });
});
