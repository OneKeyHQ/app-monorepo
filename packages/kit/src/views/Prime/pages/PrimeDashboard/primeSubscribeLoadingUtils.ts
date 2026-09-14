import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export const PRIME_SUBSCRIBE_MINIMUM_LOADING_MS = 1000;

export async function runPrimeSubscribeWithMinimumLoadingDuration<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const minimumLoadingPromise = timerUtils.wait(
    PRIME_SUBSCRIBE_MINIMUM_LOADING_MS,
  );
  try {
    return await operation();
  } finally {
    await minimumLoadingPromise;
  }
}
