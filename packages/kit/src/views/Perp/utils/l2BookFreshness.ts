import {
  PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS,
  PERPS_L2_BOOK_SWR_CACHE_MAX_AGE_MS,
} from '@onekeyhq/shared/src/consts/perpCache';
import { getPerpsL2BookSnapshotCacheKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

export type IPerpsL2BookColdCache = Record<
  string,
  {
    data: HL.IBook;
    updatedAt: number;
  }
>;

type IPerpsL2BookColdCacheGlobal = typeof globalThis & {
  __ONEKEY_PERPS_L2_BOOK_COLD_CACHE__?: IPerpsL2BookColdCache;
};

export function getPerpsL2BookColdCacheGlobalSnapshot() {
  return (globalThis as IPerpsL2BookColdCacheGlobal)
    .__ONEKEY_PERPS_L2_BOOK_COLD_CACHE__;
}

export function hasL2BookLevels(bookData: HL.IBook | null | undefined) {
  return Boolean(
    bookData?.levels?.[0]?.length && bookData?.levels?.[1]?.length,
  );
}

export function getFreshL2BookSnapshotFromColdCache({
  coin,
  options,
  cache,
  maxAgeMs = PERPS_L2_BOOK_SWR_CACHE_MAX_AGE_MS,
}: {
  coin: string;
  options?: IL2BookOptions;
  cache: IPerpsL2BookColdCache | undefined;
  maxAgeMs?: number;
}) {
  if (!cache) {
    return undefined;
  }
  const keys = getPerpsL2BookSnapshotCacheKeys({
    coin,
    nSigFigs: options?.nSigFigs,
    mantissa: options?.mantissa,
  });
  for (const key of keys) {
    const entry = cache[key];
    if (
      entry?.data?.coin === coin &&
      Date.now() - entry.updatedAt <= maxAgeMs
    ) {
      return entry.data;
    }
  }
  return undefined;
}

export function isPerpsL2BookInteractive({
  bookTime,
  bookReceivedAt,
  now = Date.now(),
}: {
  bookTime: number | undefined;
  bookReceivedAt?: number;
  now?: number;
}) {
  if (!bookTime || !Number.isFinite(bookTime)) {
    return false;
  }
  const freshnessTime =
    bookReceivedAt !== undefined && Number.isFinite(bookReceivedAt)
      ? bookReceivedAt
      : bookTime;
  return (
    Math.max(0, now - freshnessTime) <= PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS
  );
}

export function getPerpsL2BookInteractiveRefreshDelayMs({
  bookTime,
  bookReceivedAt,
  now = Date.now(),
}: {
  bookTime: number | undefined;
  bookReceivedAt?: number;
  now?: number;
}) {
  if (!bookTime || !Number.isFinite(bookTime)) {
    return undefined;
  }
  const freshnessTime =
    bookReceivedAt !== undefined && Number.isFinite(bookReceivedAt)
      ? bookReceivedAt
      : bookTime;

  const ageMs = Math.max(0, now - freshnessTime);
  if (ageMs > PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS) {
    return undefined;
  }

  return PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS - ageMs + 1;
}

export function isPerpsBboInteractive({
  bboTime,
  bboReceivedAt,
  now = Date.now(),
}: {
  bboTime: number | undefined;
  bboReceivedAt?: number;
  now?: number;
}) {
  return isPerpsL2BookInteractive({
    bookTime: bboTime,
    bookReceivedAt: bboReceivedAt,
    now,
  });
}

export function getPerpsBboInteractiveRefreshDelayMs({
  bboTime,
  bboReceivedAt,
  now = Date.now(),
}: {
  bboTime: number | undefined;
  bboReceivedAt?: number;
  now?: number;
}) {
  return getPerpsL2BookInteractiveRefreshDelayMs({
    bookTime: bboTime,
    bookReceivedAt: bboReceivedAt,
    now,
  });
}
