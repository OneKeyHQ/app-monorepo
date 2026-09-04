import timerUtils from '../utils/timerUtils';

export const LEGACY_ASYNC_STORAGE_RETRY_DELAYS_MS = [50, 500, 1000] as const;

export type ILegacyAsyncStorageRetryResult<T> =
  | {
      attemptCount: number;
      ok: true;
      value: T;
    }
  | {
      attemptCount: number;
      error: unknown;
      ok: false;
    };

export async function retryLegacyAsyncStorageOperation<T>({
  onRetry,
  operation,
}: {
  onRetry?: (context: {
    delayMs: number;
    error: unknown;
    retryCount: number;
  }) => void;
  operation: () => Promise<T>;
}): Promise<ILegacyAsyncStorageRetryResult<T>> {
  let lastError: unknown;
  const attemptCount = LEGACY_ASYNC_STORAGE_RETRY_DELAYS_MS.length + 1;

  for (let attemptIndex = 0; attemptIndex < attemptCount; attemptIndex += 1) {
    try {
      return {
        attemptCount: attemptIndex + 1,
        ok: true,
        value: await operation(),
      };
    } catch (error) {
      lastError = error;
      const delayMs = LEGACY_ASYNC_STORAGE_RETRY_DELAYS_MS[attemptIndex];
      if (delayMs === undefined) {
        break;
      }
      onRetry?.({
        delayMs,
        error,
        retryCount: attemptIndex + 1,
      });
      await timerUtils.wait(delayMs);
    }
  }

  return { attemptCount, error: lastError, ok: false };
}
