import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';

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
