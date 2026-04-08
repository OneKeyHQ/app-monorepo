import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export const UNIVERSAL_SEARCH_TRENDING_MEMORY_CACHE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({ minute: 5 });

export const UNIVERSAL_SEARCH_TRENDING_LOCAL_CACHE_STORAGE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({ hour: 24 });

export const UNIVERSAL_SEARCH_TRENDING_LOCAL_CACHE_RENDER_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({ minute: 15 });

export const UNIVERSAL_SEARCH_TRENDING_REFRESH_FAILURE_CACHE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({ minute: 5 });

function isCacheWithinAge({
  updatedAt,
  now = Date.now(),
  maxAgeMs,
}: {
  updatedAt?: number;
  now?: number;
  maxAgeMs: number;
}) {
  if (!updatedAt || updatedAt <= 0) {
    return false;
  }

  return now - updatedAt <= maxAgeMs;
}

export function shouldUseUniversalSearchTrendingMemoryCache({
  updatedAt,
  now,
}: {
  updatedAt?: number;
  now?: number;
}) {
  return isCacheWithinAge({
    updatedAt,
    now,
    maxAgeMs: UNIVERSAL_SEARCH_TRENDING_MEMORY_CACHE_MAX_AGE_MS,
  });
}

export function shouldKeepUniversalSearchTrendingCacheOnRefreshFailure({
  updatedAt,
  now,
}: {
  updatedAt?: number;
  now?: number;
}) {
  return isCacheWithinAge({
    updatedAt,
    now,
    maxAgeMs: UNIVERSAL_SEARCH_TRENDING_REFRESH_FAILURE_CACHE_MAX_AGE_MS,
  });
}

export function shouldKeepUniversalSearchTrendingLocalCacheInStorage({
  updatedAt,
  now,
}: {
  updatedAt?: number;
  now?: number;
}) {
  return isCacheWithinAge({
    updatedAt,
    now,
    maxAgeMs: UNIVERSAL_SEARCH_TRENDING_LOCAL_CACHE_STORAGE_MAX_AGE_MS,
  });
}

export function shouldRenderUniversalSearchTrendingLocalCache({
  updatedAt,
  now,
}: {
  updatedAt?: number;
  now?: number;
}) {
  return isCacheWithinAge({
    updatedAt,
    now,
    maxAgeMs: UNIVERSAL_SEARCH_TRENDING_LOCAL_CACHE_RENDER_MAX_AGE_MS,
  });
}
