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
  return now - bookTime <= PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS;
}
