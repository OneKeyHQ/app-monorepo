/* cspell:ignore Infini */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeInfiniPendingPaymentSession } from '@onekeyhq/shared/types/prime/primeTypes';

import { createPrimeInfiniPaymentSessionQueue } from './primeInfiniPaymentSessionQueue';
import {
  capturePrimeInfiniSessionRevision,
  releasePrimeInfiniTerminalSession,
} from './primeInfiniTerminalRelease';

const persistedSession = {
  updatedAt: 1000,
  sendStarted: true,
} as IPrimeInfiniPendingPaymentSession;

describe('capturePrimeInfiniSessionRevision', () => {
  it('reports the stored revision', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();

    await expect(
      capturePrimeInfiniSessionRevision({
        queue,
        fetchPersistedSession: async () => persistedSession,
      }),
    ).resolves.toEqual({ updatedAt: 1000, sendStarted: true });
  });

  it('reports no revision when there is no stored session', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();

    await expect(
      capturePrimeInfiniSessionRevision({
        queue,
        fetchPersistedSession: async () => undefined,
      }),
    ).resolves.toBeUndefined();
  });

  // A storage or main-to-background bridge failure must not abort an ordinary
  // replacement, which never needed this read. The database layer fails closed
  // on a missing revision, so degrading here cannot widen the delete.
  it('degrades to no revision when the read fails', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();

    await expect(
      capturePrimeInfiniSessionRevision({
        queue,
        fetchPersistedSession: async () => {
          throw new OneKeyLocalError('storage is unavailable');
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('leaves the queue usable after a failed read', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();
    await capturePrimeInfiniSessionRevision({
      queue,
      fetchPersistedSession: async () => {
        throw new OneKeyLocalError('storage is unavailable');
      },
    });

    const persist = jest.fn().mockResolvedValue(undefined);
    await queue.persist(persist);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

describe('releasePrimeInfiniTerminalSession', () => {
  it('reports a successful release', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();

    await expect(
      releasePrimeInfiniTerminalSession({
        queue,
        discardTerminalSession: async () => true,
      }),
    ).resolves.toBe(true);
  });

  it('reports a refused release', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();

    await expect(
      releasePrimeInfiniTerminalSession({
        queue,
        discardTerminalSession: async () => false,
      }),
    ).resolves.toBe(false);
  });

  // The regression this module exists for: finalize() only clears its finalized
  // flag when the task rejects, so a refusal that returned normally would pin
  // the queue and the caller's fallback to tracking the payment would fail with
  // "session persistence was finalized" instead of resuming polling.
  it('leaves the queue usable after a refused release', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();
    await expect(
      releasePrimeInfiniTerminalSession({
        queue,
        discardTerminalSession: async () => false,
      }),
    ).resolves.toBe(false);

    const persist = jest.fn().mockResolvedValue('tracked');
    await expect(queue.persist(persist)).resolves.toBe('tracked');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('finalizes the queue after a successful release', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();
    await releasePrimeInfiniTerminalSession({
      queue,
      discardTerminalSession: async () => true,
    });

    const persist = jest.fn();
    await expect(queue.persist(persist)).resolves.toBeUndefined();
    expect(persist).not.toHaveBeenCalled();
  });

  it('propagates an unexpected discard failure', async () => {
    const queue = createPrimeInfiniPaymentSessionQueue();

    await expect(
      releasePrimeInfiniTerminalSession({
        queue,
        discardTerminalSession: async () => {
          throw new OneKeyLocalError('database is unavailable');
        },
      }),
    ).rejects.toThrow('database is unavailable');
  });
});
