import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IPerpOrderBookTickOptionPersist } from '@onekeyhq/shared/types/hyperliquid/types';

export type IPerpsOrderBookTickOptionsCache = Record<
  string,
  IPerpOrderBookTickOptionPersist
>;

const ORDER_BOOK_TICK_OPTIONS_CACHE_KEY = swrKeys.perpsOrderBookTickOptions();

export function getPerpsOrderBookTickOptionsCache(): IPerpsOrderBookTickOptionsCache {
  return (
    swrCacheUtils.get<IPerpsOrderBookTickOptionsCache>(
      ORDER_BOOK_TICK_OPTIONS_CACHE_KEY,
    ) ?? {}
  );
}

export function setPerpsOrderBookTickOptionsCache(
  options: IPerpsOrderBookTickOptionsCache,
) {
  swrCacheUtils.set(ORDER_BOOK_TICK_OPTIONS_CACHE_KEY, options);
  swrCacheUtils.flushNow();
}

export function getPerpsOrderBookTickOptionsWithCache(
  options: IPerpsOrderBookTickOptionsCache,
): IPerpsOrderBookTickOptionsCache {
  const cached = getPerpsOrderBookTickOptionsCache();
  return {
    ...cached,
    ...options,
  };
}

export function getPerpsOrderBookTickOptionWithCache({
  coin,
  options,
}: {
  coin: string | undefined;
  options: IPerpsOrderBookTickOptionsCache;
}) {
  if (!coin) {
    return undefined;
  }
  return getPerpsOrderBookTickOptionsWithCache(options)[coin];
}
