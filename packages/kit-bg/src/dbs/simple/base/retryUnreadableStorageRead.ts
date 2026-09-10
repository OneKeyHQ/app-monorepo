import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';

import { isUnreadableStorageValueError } from './unreadableStorageValueError';

// First failure + these retries (with backoff) before delete.
// Keeps transient Chromium IO from being mistaken for durable blob corruption.
export const UNREADABLE_SELF_HEAL_RETRY_DELAYS_MS = [50, 500, 1000] as const;
export const UNREADABLE_SELF_HEAL_MAX_RETRIES =
  UNREADABLE_SELF_HEAL_RETRY_DELAYS_MS.length;

export function getUnreadableSelfHealDelayMs(retryIndex: number): number {
  return (
    UNREADABLE_SELF_HEAL_RETRY_DELAYS_MS[retryIndex] ??
    UNREADABLE_SELF_HEAL_RETRY_DELAYS_MS[
      UNREADABLE_SELF_HEAL_RETRY_DELAYS_MS.length - 1
    ]
  );
}

export function getStorageErrorMeta(error: unknown): {
  errorName: string;
  errorMessage: string;
} {
  const { name, message } = (error ?? {}) as {
    name?: string;
    message?: string;
  };
  return {
    errorName: name || 'Error',
    errorMessage: message || String(error ?? ''),
  };
}

export type IUnreadableSelfHealLogPhase =
  | 'detected'
  | 'retry'
  | 'recovered'
  | 'deleted'
  | 'deleteSkipped';

export type IUnreadableSelfHealLogger = (params: {
  phase: IUnreadableSelfHealLogPhase;
  errorName: string;
  errorMessage: string;
  attempt?: number;
  delayMs?: number;
  reason?: string;
}) => void;

/**
 * After the first unreadable-blob read failure: backoff retries, then invoke
 * onDelete unless a write-overlap vetoes it.
 * Returns the recovered value, or null when the record was dropped / skipped.
 */
export async function retryUnreadableStorageRead<T>({
  read,
  shouldDelete,
  onDelete,
  log,
  errorMeta,
  wait = waitAsync,
  maxRetries = UNREADABLE_SELF_HEAL_MAX_RETRIES,
}: {
  read: () => Promise<T>;
  shouldDelete: () => boolean;
  onDelete: () => Promise<void>;
  log: IUnreadableSelfHealLogger;
  errorMeta: { errorName: string; errorMessage: string };
  wait?: (ms: number) => Promise<unknown>;
  maxRetries?: number;
}): Promise<T | null> {
  let latestErrorMeta = errorMeta;
  const withError = (
    entry: Omit<
      Parameters<IUnreadableSelfHealLogger>[0],
      'errorName' | 'errorMessage'
    >,
  ): Parameters<IUnreadableSelfHealLogger>[0] => ({
    ...latestErrorMeta,
    ...entry,
  });

  for (let retryIndex = 0; retryIndex < maxRetries; retryIndex += 1) {
    const delayMs = getUnreadableSelfHealDelayMs(retryIndex);
    log(withError({ phase: 'retry', attempt: retryIndex + 1, delayMs }));
    await wait(delayMs);
    try {
      const value = await read();
      log(withError({ phase: 'recovered', attempt: retryIndex + 1 }));
      return value;
    } catch (retryError) {
      if (!isUnreadableStorageValueError(retryError)) {
        throw retryError;
      }
      // Prefer the latest thrown message so wrapped/variants stay visible.
      latestErrorMeta = getStorageErrorMeta(retryError);
    }
  }

  if (shouldDelete()) {
    await onDelete();
    log(withError({ phase: 'deleted' }));
  } else {
    log(withError({ phase: 'deleteSkipped', reason: 'writeOverlap' }));
  }
  return null;
}
