import {
  PerKeyMutationQueue,
  executeOrderBookSubscriptionTransition,
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
  it('reconnects and skips replacement creation when unsubscribe fails', async () => {
    const create = jest.fn<Promise<void>, [string]>(() => Promise.resolve());
    const reconnect = jest.fn<Promise<void>, []>(() => Promise.resolve());

    const result = await executeOrderBookSubscriptionTransition({
      toDestroy: ['old'],
      toCreate: ['new'],
      destroy: () => Promise.resolve(false),
      create,
      isPending: () => true,
      runExclusive: (task) => task(),
      reconnect,
    });

    expect(result).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(reconnect).toHaveBeenCalledTimes(1);
  });
});
