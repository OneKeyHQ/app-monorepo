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
  // Debounced like every other SWR writer. flushNow() is for app-background,
  // and forcing it here made each write a synchronous full-store read, merge
  // and MMKV rewrite on the calling runtime; simpleDb holds the durable copy,
  // so this cache only needs to be eventually consistent.
  swrCacheUtils.set(ORDER_BOOK_TICK_OPTIONS_CACHE_KEY, options);
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
