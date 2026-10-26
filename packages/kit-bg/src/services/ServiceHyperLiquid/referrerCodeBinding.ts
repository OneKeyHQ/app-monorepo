type IReferrerCodeBindingCache = {
  referrerCodeSetDone: Record<string, boolean>;
  referrerCodeSetInFlight: Record<string, Promise<void>>;
};

export function isReferrerAlreadySetError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { name, response } = error as {
    name?: unknown;
    response?: unknown;
  };
  if (name !== 'ApiRequestError' || !response || typeof response !== 'object') {
    return false;
  }
  const result = response as { status?: unknown; response?: unknown };
  return result.status === 'err' && result.response === 'Referrer already set';
}

export function createStaleReferrerBindingError(): Error & {
  isStaleReferrerBinding: true;
} {
  return Object.assign(
    new Error('Referrer binding aborted due to account switch'),
    {
      isStaleReferrerBinding: true as const,
    },
  );
}

export function isStaleReferrerBindingError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (error as { isStaleReferrerBinding?: unknown }).isStaleReferrerBinding ===
      true,
  );
}

export function scheduleReferrerCodeBinding({
  cache,
  cacheKey,
  isAlreadyBound,
  getReferralCode,
  setReferrerCode,
  onBound,
  onFailure,
}: {
  cache: IReferrerCodeBindingCache;
  cacheKey: string;
  isAlreadyBound?: () => Promise<boolean>;
  getReferralCode: () => Promise<string>;
  setReferrerCode: (code: string) => Promise<unknown>;
  onBound?: () => void | Promise<void>;
  onFailure: (error: unknown) => void | Promise<void>;
}): Promise<void> | undefined {
  if (cache.referrerCodeSetDone[cacheKey]) {
    return undefined;
  }
  if (cache.referrerCodeSetInFlight[cacheKey] !== undefined) {
    return cache.referrerCodeSetInFlight[cacheKey];
  }

  let skippedBecauseAlreadyBound = false;
  const binding = Promise.resolve().then(async () => {
    if (isAlreadyBound && (await isAlreadyBound())) {
      skippedBecauseAlreadyBound = true;
      return;
    }
    const code = await getReferralCode();
    try {
      await setReferrerCode(code);
    } catch (error) {
      if (!isReferrerAlreadySetError(error)) {
        throw error;
      }
    }
  });
  const task = binding
    .then(async () => {
      if (cache.referrerCodeSetInFlight[cacheKey] === task) {
        cache.referrerCodeSetDone[cacheKey] = true;
        if (!skippedBecauseAlreadyBound) {
          try {
            await onBound?.();
          } catch {
            // Best-effort banner cache synchronization after successful or idempotent binding
          }
        }
      }
    })
    .catch(async (error: unknown) => {
      if (isStaleReferrerBindingError(error)) {
        return;
      }
      try {
        await onFailure(error);
      } catch {
        console.error('Failed to log Hyperliquid referrer binding error');
      }
    })
    .finally(() => {
      if (cache.referrerCodeSetInFlight[cacheKey] === task) {
        delete cache.referrerCodeSetInFlight[cacheKey];
      }
    });
  cache.referrerCodeSetInFlight[cacheKey] = task;
  return task;
}
