import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';

export function isPerpsL2BookInteractive({
  bookTime,
  now = Date.now(),
}: {
  bookTime: number | undefined;
  now?: number;
}) {
  if (!bookTime || !Number.isFinite(bookTime)) {
    return false;
  }
  return Math.max(0, now - bookTime) <= PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS;
}

export function getPerpsL2BookInteractiveRefreshDelayMs({
  bookTime,
  now = Date.now(),
}: {
  bookTime: number | undefined;
  now?: number;
}) {
  if (!bookTime || !Number.isFinite(bookTime)) {
    return undefined;
  }

  const ageMs = Math.max(0, now - bookTime);
  if (ageMs > PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS) {
    return undefined;
  }

  return PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS - ageMs + 1;
}
