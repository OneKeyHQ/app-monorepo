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

type IPerpsCachedL2Book = HL.IBook & {
  localReceivedAt?: number;
  isCachedSnapshot?: boolean;
};

type IPerpsL2BookColdCacheGlobal = typeof globalThis & {
  __ONEKEY_PERPS_L2_BOOK_COLD_CACHE__?: IPerpsL2BookColdCache;
};

export function getPerpsL2BookColdCacheGlobalSnapshot() {
  return (globalThis as IPerpsL2BookColdCacheGlobal)
    .__ONEKEY_PERPS_L2_BOOK_COLD_CACHE__;
}

export function hasL2BookSides(bookData: HL.IBook | null | undefined) {
  const [bids, asks] = bookData?.levels ?? [];
  return Array.isArray(bids) && Array.isArray(asks);
}

function isPositiveDecimal(value: string | undefined) {
  if (typeof value !== 'string') return false;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number === parseFloat(value);
}

function isValidDepthLevel(level: HL.IBookLevel) {
  return isPositiveDecimal(level?.px) && isPositiveDecimal(level?.sz);
}

export function hasL2BookSnapshot(
  book: HL.IBook | null | undefined,
): book is HL.IBook {
  if (
    !book ||
    !Number.isFinite(book.time) ||
    book.time <= 0 ||
    !Array.isArray(book.levels)
  ) {
    return false;
  }
  const [bids, asks] = book.levels;
  return (
    Array.isArray(bids) &&
    Array.isArray(asks) &&
    bids.every(isValidDepthLevel) &&
    asks.every(isValidDepthLevel)
  );
}

export function getPerpsDepthChartStatus({
  book,
  isConnectionReady,
  hasLoadFailed,
  now,
}: {
  book: IPerpsCachedL2Book | null;
  isConnectionReady: boolean;
  hasLoadFailed: boolean;
  now?: number;
}): 'loading' | 'empty' | 'error' | 'stale' | 'ready' {
  if (!hasL2BookSnapshot(book)) {
    return hasLoadFailed ? 'error' : 'loading';
  }
  if (
    !isConnectionReady ||
    !isPerpsL2BookInteractive({
      bookTime: book.time,
      bookReceivedAt: book.localReceivedAt,
      isCachedSnapshot: book.isCachedSnapshot,
      now,
    })
  ) {
    return 'stale';
  }
  return book.levels[0].length || book.levels[1].length ? 'ready' : 'empty';
}

export function isL2BookForTarget(
  book: HL.IBook | null | undefined,
  coin: string,
  options?: IL2BookOptions,
) {
  return (
    book?.coin === coin &&
    book.nSigFigs !== undefined &&
    book.mantissa !== undefined &&
    (book.nSigFigs ?? null) === (options?.nSigFigs ?? null) &&
    (book.mantissa ?? null) === (options?.mantissa ?? null)
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
      isL2BookForTarget(entry?.data, coin, options) &&
      Date.now() - entry.updatedAt <= maxAgeMs
    ) {
      return {
        ...entry.data,
        localReceivedAt: entry.updatedAt,
        isCachedSnapshot: true,
      } as IPerpsCachedL2Book;
    }
  }
  return undefined;
}

export function isPerpsL2BookInteractive({
  bookTime,
  bookReceivedAt,
  isCachedSnapshot,
  now = Date.now(),
}: {
  bookTime: number | undefined;
  bookReceivedAt?: number;
  isCachedSnapshot?: boolean;
  now?: number;
}) {
  if (isCachedSnapshot || !bookTime || !Number.isFinite(bookTime)) {
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
  isCachedSnapshot,
  now = Date.now(),
}: {
  bookTime: number | undefined;
  bookReceivedAt?: number;
  isCachedSnapshot?: boolean;
  now?: number;
}) {
  if (isCachedSnapshot || !bookTime || !Number.isFinite(bookTime)) {
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
