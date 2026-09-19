type IReferrerCodeBindingCache = {
  referrerCodeSetDone: Record<string, boolean>;
  referrerCodeSetInFlight: Record<string, Promise<void>>;
};

function isReferrerAlreadySetError(error: unknown): boolean {
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

export function scheduleReferrerCodeBinding({
  cache,
  cacheKey,
  getReferralCode,
  setReferrerCode,
  onFailure,
}: {
  cache: IReferrerCodeBindingCache;
  cacheKey: string;
  getReferralCode: () => Promise<string>;
  setReferrerCode: (code: string) => Promise<unknown>;
  onFailure: (error: unknown) => void | Promise<void>;
}): Promise<void> | undefined {
  if (cache.referrerCodeSetDone[cacheKey]) {
    return undefined;
  }
  if (cache.referrerCodeSetInFlight[cacheKey] !== undefined) {
    return cache.referrerCodeSetInFlight[cacheKey];
  }

  const binding = Promise.resolve().then(async () => {
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
    .then(() => {
      if (cache.referrerCodeSetInFlight[cacheKey] === task) {
        cache.referrerCodeSetDone[cacheKey] = true;
      }
    })
    .catch(async (error: unknown) => {
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
