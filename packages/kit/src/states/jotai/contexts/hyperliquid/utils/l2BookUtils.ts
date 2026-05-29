import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';

const PERPS_L2_BOOK_FRESHNESS_REFRESH_MIN_INTERVAL_MS =
  PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS / 2;

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
  if (!arePerpsL2BookLevelsEqual(currentBook, nextBook)) {
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
