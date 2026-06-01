import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';

import {
  getPerpsL2BookInteractiveRefreshDelayMs,
  isPerpsL2BookInteractive,
} from './l2BookFreshness';

const now = 1_000_000;

describe('isPerpsL2BookInteractive', () => {
  it('allows only fresh order book snapshots to be interactive', () => {
    expect(
      isPerpsL2BookInteractive({
        bookTime: now - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS,
        now,
      }),
    ).toBe(true);

    expect(
      isPerpsL2BookInteractive({
        bookTime: now - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS - 1,
        now,
      }),
    ).toBe(false);
  });

  it('rejects missing book timestamps', () => {
    expect(
      isPerpsL2BookInteractive({
        bookTime: undefined,
        now,
      }),
    ).toBe(false);

    expect(
      isPerpsL2BookInteractive({
        bookTime: undefined,
        bookReceivedAt: now,
        now,
      }),
    ).toBe(false);
  });

  it('uses local receive time for trading interactivity when available', () => {
    expect(
      isPerpsL2BookInteractive({
        bookTime: now + 60_000,
        bookReceivedAt: now - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS - 1,
        now,
      }),
    ).toBe(false);

    expect(
      isPerpsL2BookInteractive({
        bookTime: now - 60_000,
        bookReceivedAt: now - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS,
        now,
      }),
    ).toBe(true);
  });

  it('treats future server timestamps as interactive but keeps zero rejected', () => {
    expect(
      isPerpsL2BookInteractive({
        bookTime: now + 5000,
        now,
      }),
    ).toBe(true);

    expect(
      isPerpsL2BookInteractive({
        bookTime: 0,
        now,
      }),
    ).toBe(false);
  });

  it('schedules one refresh exactly when an interactive book expires', () => {
    expect(
      getPerpsL2BookInteractiveRefreshDelayMs({
        bookTime: now - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS + 250,
        now,
      }),
    ).toBe(251);

    expect(
      getPerpsL2BookInteractiveRefreshDelayMs({
        bookTime: now - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS,
        now,
      }),
    ).toBe(1);

    expect(
      getPerpsL2BookInteractiveRefreshDelayMs({
        bookTime: now - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS - 1,
        now,
      }),
    ).toBeUndefined();
  });

  it('schedules refreshes from local receive time when available', () => {
    expect(
      getPerpsL2BookInteractiveRefreshDelayMs({
        bookTime: now + 60_000,
        bookReceivedAt: now - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS + 500,
        now,
      }),
    ).toBe(501);

    expect(
      getPerpsL2BookInteractiveRefreshDelayMs({
        bookTime: now + 60_000,
        bookReceivedAt: now - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS - 1,
        now,
      }),
    ).toBeUndefined();
  });
});
