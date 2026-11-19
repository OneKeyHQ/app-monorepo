import { waitForSwapHistoryRecipientReset } from './waitForSwapHistoryRecipientReset';

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('waitForSwapHistoryRecipientReset', () => {
  it('waits for both the reset acknowledgement and the local settings update', async () => {
    const reset = deferred<void>();
    let enabled = true;
    let onChange = () => {};
    const unsubscribe = jest.fn();
    const operation = waitForSwapHistoryRecipientReset({
      reset: () => reset.promise,
      readIsEnabled: async () => enabled,
      subscribe: (callback) => {
        onChange = callback;
        return unsubscribe;
      },
    });
    const settled = jest.fn();
    void operation.promise.then(settled);
    reset.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    enabled = false;
    onChange();
    await expect(operation.promise).resolves.toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('accepts an echo that arrives before the reset acknowledgement', async () => {
    const reset = deferred<void>();
    let enabled = true;
    let onChange = () => {};
    const operation = waitForSwapHistoryRecipientReset({
      reset: () => reset.promise,
      readIsEnabled: async () => enabled,
      subscribe: (callback) => {
        onChange = callback;
        return () => {};
      },
    });
    enabled = false;
    onChange();
    reset.resolve();
    await expect(operation.promise).resolves.toBe(true);
  });

  it('cancels and unsubscribes on navigation away, even if the write later resolves', async () => {
    const reset = deferred<void>();
    const unsubscribe = jest.fn();
    const operation = waitForSwapHistoryRecipientReset({
      reset: () => reset.promise,
      readIsEnabled: async () => false,
      subscribe: () => unsubscribe,
    });
    operation.cancel();
    reset.resolve();
    await expect(operation.promise).resolves.toBe(false);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('rejects if the reset fails', async () => {
    const unsubscribe = jest.fn();
    const operation = waitForSwapHistoryRecipientReset({
      reset: () => Promise.reject(new Error('write failed')),
      readIsEnabled: async () => false,
      subscribe: () => unsubscribe,
    });
    await expect(operation.promise).rejects.toThrow('write failed');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('rejects and unsubscribes if either the write or local echo never arrives', async () => {
    jest.useFakeTimers();
    try {
      const unsubscribe = jest.fn();
      const operation = waitForSwapHistoryRecipientReset({
        reset: () => Promise.resolve(),
        readIsEnabled: async () => true,
        subscribe: () => unsubscribe,
        timeoutMs: 100,
      });
      const result = operation.promise.catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(100);
      expect(await result).toEqual(
        new Error('Recipient setting reset timed out'),
      );
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores an older read after a newer settings change', async () => {
    const oldRead = deferred<boolean>();
    let onChange = () => {};
    const readIsEnabled = jest
      .fn()
      .mockReturnValueOnce(oldRead.promise)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const operation = waitForSwapHistoryRecipientReset({
      reset: () => Promise.resolve(),
      readIsEnabled,
      subscribe: (callback) => {
        onChange = callback;
        return () => {};
      },
    });
    const settled = jest.fn();
    void operation.promise.then(settled);
    await Promise.resolve();
    await Promise.resolve();
    onChange();
    await Promise.resolve();
    await Promise.resolve();
    oldRead.resolve(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    onChange();
    await expect(operation.promise).resolves.toBe(true);
  });
});
