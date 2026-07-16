import {
  PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS,
  PERPS_SNAPSHOT_CACHE_MAX_ENTRIES,
} from '@onekeyhq/shared/src/consts/perpCache';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';

export type IPerpsL2BookWithLocalReceivedAt = HL.IBook & {
  localReceivedAt?: number;
  isCachedSnapshot?: boolean;
};

export type IPerpsBboWithLocalReceivedAt = HL.IWsBbo & {
  localReceivedAt?: number;
};

export type IPerpsL2BookColdCache = Record<
  string,
  {
    data: IPerpsL2BookWithLocalReceivedAt;
    updatedAt: number;
  }
>;

// Keep this below the interactive TTL so a live-but-unchanged book refreshes
// its local timestamp before the trading interaction gate can expire it.
const PERPS_L2_BOOK_FRESHNESS_REFRESH_MIN_INTERVAL_MS =
  PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS / 2;

export function shouldWritePerpsL2BookColdCacheTarget({
  cache,
  targetKey,
  now,
  minWriteIntervalMs,
}: {
  cache: IPerpsL2BookColdCache;
  targetKey: string;
  now: number;
  minWriteIntervalMs: number;
}) {
  const entry = cache[targetKey];
  return !entry || now - entry.updatedAt >= minWriteIntervalMs;
}

export function upsertPerpsL2BookColdCacheTarget({
  cache,
  targetKeys,
  data,
  updatedAt,
}: {
  cache: IPerpsL2BookColdCache;
  targetKeys: string[];
  data: IPerpsL2BookWithLocalReceivedAt;
  updatedAt: number;
}): IPerpsL2BookColdCache {
  const nextCache = { ...cache };
  targetKeys.forEach((key) => {
    const current = nextCache[key];
    if (!current || current.updatedAt < updatedAt) {
      nextCache[key] = { data, updatedAt };
    }
  });
  return Object.fromEntries(
    Object.entries(nextCache)
      .toSorted((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, PERPS_SNAPSHOT_CACHE_MAX_ENTRIES * 2),
  );
}

export function withPerpsL2BookLocalReceivedAt(
  book: HL.IBook,
  localReceivedAt?: number,
  isCachedSnapshot?: boolean,
): IPerpsL2BookWithLocalReceivedAt {
  const current = book as IPerpsL2BookWithLocalReceivedAt;
  return {
    ...book,
    localReceivedAt: localReceivedAt ?? current.localReceivedAt ?? Date.now(),
    isCachedSnapshot: isCachedSnapshot ?? current.isCachedSnapshot,
  };
}

export function withPerpsBboLocalReceivedAt(
  bbo: HL.IWsBbo,
  localReceivedAt?: number,
): IPerpsBboWithLocalReceivedAt {
  return {
    ...bbo,
    localReceivedAt:
      localReceivedAt ??
      (bbo as IPerpsBboWithLocalReceivedAt).localReceivedAt ??
      Date.now(),
  };
}

export function getPerpsMarketDataLocalReceivedAt(
  data:
    | IPerpsL2BookWithLocalReceivedAt
    | IPerpsBboWithLocalReceivedAt
    | null
    | undefined,
) {
  return data?.localReceivedAt;
}

function isL2BookLevelEqual(
  prevLevel: HL.IBookLevel | undefined,
  nextLevel: HL.IBookLevel | undefined,
) {
  return (
    prevLevel?.px === nextLevel?.px &&
    prevLevel?.sz === nextLevel?.sz &&
    prevLevel?.n === nextLevel?.n
  );
}

export function arePerpsL2BookLevelsEqual(
  currentBook: HL.IBook | null | undefined,
  nextBook: HL.IBook,
) {
  if (!currentBook || currentBook.coin !== nextBook.coin) {
    return false;
  }

  const prevSides = currentBook.levels ?? [];
  const nextSides = nextBook.levels ?? [];
  if (prevSides.length !== nextSides.length) {
    return false;
  }

  for (let sideIndex = 0; sideIndex < nextSides.length; sideIndex += 1) {
    const prevLevels = prevSides[sideIndex] ?? [];
    const nextLevels = nextSides[sideIndex] ?? [];
    if (prevLevels.length !== nextLevels.length) {
      return false;
    }

    for (let levelIndex = 0; levelIndex < nextLevels.length; levelIndex += 1) {
      if (!isL2BookLevelEqual(prevLevels[levelIndex], nextLevels[levelIndex])) {
        return false;
      }
    }
  }

  return true;
}

export function shouldUpdatePerpsL2Book({
  currentBook,
  nextBook,
}: {
  currentBook: HL.IBook | null;
  nextBook: HL.IBook;
}) {
  const isCurrentCached = Boolean(
    (currentBook as IPerpsL2BookWithLocalReceivedAt | null)?.isCachedSnapshot,
  );
  const isNextCached = Boolean(
    (nextBook as IPerpsL2BookWithLocalReceivedAt).isCachedSnapshot,
  );
  if (isCurrentCached !== isNextCached) {
    return isCurrentCached && !isNextCached;
  }

  if (!arePerpsL2BookLevelsEqual(currentBook, nextBook)) {
    return true;
  }

  if (
    (currentBook?.nSigFigs ?? null) !== (nextBook.nSigFigs ?? null) ||
    (currentBook?.mantissa ?? null) !== (nextBook.mantissa ?? null)
  ) {
    return true;
  }

  const currentTime = currentBook?.time;
  const nextTime = nextBook.time;
  const hasCurrentTime =
    currentTime !== undefined && Number.isFinite(currentTime);
  return (
    Number.isFinite(nextTime) &&
    (!hasCurrentTime ||
      nextTime - currentTime >= PERPS_L2_BOOK_FRESHNESS_REFRESH_MIN_INTERVAL_MS)
  );
}

export function shouldUpdatePerpsBbo({
  currentBbo,
  nextBbo,
}: {
  currentBbo: HL.IWsBbo | null;
  nextBbo: HL.IWsBbo;
}) {
  if (!currentBbo || currentBbo.coin !== nextBbo.coin) {
    return true;
  }

  const currentBidPx = currentBbo.bbo[0]?.px;
  const currentAskPx = currentBbo.bbo[1]?.px;
  const nextBidPx = nextBbo.bbo[0]?.px;
  const nextAskPx = nextBbo.bbo[1]?.px;
  if (currentBidPx !== nextBidPx || currentAskPx !== nextAskPx) {
    return true;
  }

  const currentTime = currentBbo.time;
  const nextTime = nextBbo.time;
  const hasCurrentTime =
    currentTime !== undefined && Number.isFinite(currentTime);
  return (
    Number.isFinite(nextTime) &&
    (!hasCurrentTime ||
      nextTime - currentTime >= PERPS_L2_BOOK_FRESHNESS_REFRESH_MIN_INTERVAL_MS)
  );
}

export function shouldClearPerpsMarketDataForInstrument({
  dataCoin,
  activeCoin,
}: {
  dataCoin: string | undefined;
  activeCoin: string | undefined;
}) {
  return Boolean(dataCoin && dataCoin !== activeCoin);
}
