/* cspell:ignore Infini */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createPrimeInfiniPaymentSessionQueue } from './primeInfiniPaymentSessionQueue';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('createPrimeInfiniPaymentSessionQueue', () => {
  it('waits for an in-flight persist before clearing and blocks resurrection', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();
    const deferredPersist = createDeferred();
    const calls: string[] = [];

    const persistPromise = queue.persist(async () => {
      calls.push('persist-start');
      await deferredPersist.promise;
      calls.push('persist-end');
    });
    const finalizePromise = queue.finalize(async () => {
      calls.push('clear');
    });
    await queue.persist(async () => {
      calls.push('late-persist');
    });
    await Promise.resolve();

    expect(calls).toEqual(['persist-start']);
    deferredPersist.resolve();
    await Promise.all([persistPromise, finalizePromise]);
    expect(calls).toEqual(['persist-start', 'persist-end', 'clear']);
  });

  it('allows persistence to resume when finalization fails', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();
    await expect(
      queue.finalize(async () => {
        throw new OneKeyLocalError('clear failed');
      }),
    ).rejects.toThrow('clear failed');

    const persist = jest.fn().mockResolvedValue(undefined);
    await queue.persist(persist);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
