import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  getFreshL2BookSnapshotFromColdCache,
  getPerpsL2BookColdCacheGlobalSnapshot,
  getPerpsL2BookInteractiveRefreshDelayMs,
  hasL2BookLevels,
  isPerpsL2BookInteractive,
} from './l2BookFreshness';

const now = 1_000_000;

type IPerpsL2BookColdCacheGlobal = typeof globalThis & {
  __ONEKEY_PERPS_L2_BOOK_COLD_CACHE__?: unknown;
};

afterEach(() => {
  delete (globalThis as IPerpsL2BookColdCacheGlobal)
    .__ONEKEY_PERPS_L2_BOOK_COLD_CACHE__;
});

function buildBook({
  bidLevels,
  askLevels,
}: {
  bidLevels?: HL.IBookLevel[];
  askLevels?: HL.IBookLevel[];
}): HL.IBook {
  return {
    coin: 'ETH',
    levels: [bidLevels ?? [], askLevels ?? []],
    time: now,
  };
}

describe('hasL2BookLevels', () => {
  it('requires both sides to have renderable levels', () => {
    expect(
      hasL2BookLevels(
        buildBook({
          bidLevels: [{ px: '1', sz: '1', n: 1 }],
          askLevels: [{ px: '2', sz: '1', n: 1 }],
        }),
      ),
    ).toBe(true);

    expect(
      hasL2BookLevels(
        buildBook({
          bidLevels: [{ px: '1', sz: '1', n: 1 }],
        }),
      ),
    ).toBe(false);
    expect(
      hasL2BookLevels(
        buildBook({
          askLevels: [{ px: '2', sz: '1', n: 1 }],
        }),
      ),
    ).toBe(false);
    expect(hasL2BookLevels(undefined)).toBe(false);
  });
});

describe('getFreshL2BookSnapshotFromColdCache', () => {
  it('falls back from option-specific lookup to the latest coin snapshot', () => {
    const book = buildBook({
      bidLevels: [{ px: '1', sz: '1', n: 1 }],
      askLevels: [{ px: '2', sz: '1', n: 1 }],
    });

    expect(
      getFreshL2BookSnapshotFromColdCache({
        coin: 'ETH',
        options: {
          nSigFigs: 5,
          mantissa: null,
        },
        cache: {
          'perpsL2Book:v1:ETH:latest': {
            data: book,
            updatedAt: Date.now(),
          },
        },
      }),
    ).toBe(book);
  });

  it('rejects stale or wrong-coin cold cache entries', () => {
    const book = buildBook({
      bidLevels: [{ px: '1', sz: '1', n: 1 }],
      askLevels: [{ px: '2', sz: '1', n: 1 }],
    });

    expect(
      getFreshL2BookSnapshotFromColdCache({
        coin: 'BTC',
        cache: {
          'perpsL2Book:v1:BTC:latest': {
            data: book,
            updatedAt: Date.now(),
          },
        },
      }),
    ).toBeUndefined();

    expect(
      getFreshL2BookSnapshotFromColdCache({
        coin: 'ETH',
        cache: {
          'perpsL2Book:v1:ETH:latest': {
            data: book,
            updatedAt: 1,
          },
        },
        maxAgeMs: 1,
      }),
    ).toBeUndefined();
  });
});

describe('getPerpsL2BookColdCacheGlobalSnapshot', () => {
  it('reads the preserved perps L2 book cold-start snapshot', () => {
    const cache = {
      'perpsL2Book:v1:ETH:latest': {
        data: buildBook({
          bidLevels: [{ px: '1', sz: '1', n: 1 }],
          askLevels: [{ px: '2', sz: '1', n: 1 }],
        }),
        updatedAt: now,
      },
    };
    (
      globalThis as IPerpsL2BookColdCacheGlobal
    ).__ONEKEY_PERPS_L2_BOOK_COLD_CACHE__ = cache;

    expect(getPerpsL2BookColdCacheGlobalSnapshot()).toBe(cache);
  });
});

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
