import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  PRIME_SUBSCRIBE_MINIMUM_LOADING_MS,
  runPrimeSubscribeWithMinimumLoadingDuration,
} from './primeSubscribeLoadingUtils';

describe('primeSubscribeLoadingUtils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a fast successful subscription action pending for one second', async () => {
    const operation = jest.fn(async () => 'completed');
    let result: string | undefined;
    const promise = runPrimeSubscribeWithMinimumLoadingDuration(operation).then(
      (value) => {
        result = value;
      },
    );

    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();

    await jest.advanceTimersByTimeAsync(PRIME_SUBSCRIBE_MINIMUM_LOADING_MS - 1);
    expect(result).toBeUndefined();

    await jest.advanceTimersByTimeAsync(1);
    await promise;
    expect(result).toBe('completed');
  });

  it('keeps a fast failed subscription action pending for one second', async () => {
    const error = new OneKeyLocalError('Subscription failed');
    const promise = runPrimeSubscribeWithMinimumLoadingDuration(async () => {
      throw error;
    });
    void promise.catch(() => undefined);

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(PRIME_SUBSCRIBE_MINIMUM_LOADING_MS - 1);

    let rejection: unknown;
    void promise.catch((reason: unknown) => {
      rejection = reason;
    });
    await Promise.resolve();
    expect(rejection).toBeUndefined();

    await jest.advanceTimersByTimeAsync(1);
    await expect(promise).rejects.toBe(error);
  });

  it('does not add another second after a slow subscription action', async () => {
    let finishOperation: ((value: string) => void) | undefined;
    const operation = new Promise<string>((resolve) => {
      finishOperation = resolve;
    });
    let result: string | undefined;
    const promise = runPrimeSubscribeWithMinimumLoadingDuration(
      () => operation,
    ).then((value) => {
      result = value;
    });

    await jest.advanceTimersByTimeAsync(
      PRIME_SUBSCRIBE_MINIMUM_LOADING_MS + 500,
    );
    expect(result).toBeUndefined();

    finishOperation?.('completed');
    await promise;
    expect(result).toBe('completed');
  });
});
