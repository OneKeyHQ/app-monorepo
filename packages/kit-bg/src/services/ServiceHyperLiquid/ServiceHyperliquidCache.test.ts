import type { IBook } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildL2BookSnapshotCachePayload,
  getL2BookSnapshotCacheEntryLevelCount,
  selectL2BookSnapshotCacheEntry,
  shouldWritePerpsAccountDisplayCache,
} from './ServiceHyperliquidCache';

import type { IPerpsL2BookSnapshotCacheEntry } from '../../dbs/simple/entity/SimpleDbEntityPerp';

function buildBook({
  coin = 'BTC',
  bidLevels,
  askLevels,
}: {
  coin?: string;
  bidLevels: number;
  askLevels: number;
}): IBook {
  return {
    coin,
    levels: [
      Array.from({ length: bidLevels }, (_, index) => ({
        px: `${100 - index}`,
        sz: '1',
        n: 1,
      })),
      Array.from({ length: askLevels }, (_, index) => ({
        px: `${101 + index}`,
        sz: '1',
        n: 1,
      })),
    ],
  } as IBook;
}

function buildEntry({
  updatedAt,
  bidLevels,
  askLevels,
}: {
  updatedAt: number;
  bidLevels: number;
  askLevels: number;
}): IPerpsL2BookSnapshotCacheEntry {
  return {
    data: buildBook({ bidLevels, askLevels }),
    updatedAt,
  };
}

describe('ServiceHyperliquidCache L2 book helpers', () => {
  it('counts the shallower side of the cached L2 book', () => {
    expect(
      getL2BookSnapshotCacheEntryLevelCount(
        buildEntry({ updatedAt: 1, bidLevels: 20, askLevels: 12 }),
      ),
    ).toBe(12);
  });

  it('selects the newest complete L2 book snapshot from cache candidates', () => {
    const simpleDbEntry = buildEntry({
      updatedAt: 100,
      bidLevels: 18,
      askLevels: 18,
    });
    const newerIncompleteSwrEntry = buildEntry({
      updatedAt: 200,
      bidLevels: 25,
      askLevels: 4,
    });

    expect(
      selectL2BookSnapshotCacheEntry({
        simpleDbEntry,
        swrEntry: newerIncompleteSwrEntry,
      }),
    ).toBe(simpleDbEntry);
  });

  it('builds option-specific payload only for the active book', () => {
    const data = buildBook({ coin: 'ETH', bidLevels: 20, askLevels: 20 });

    expect(
      buildL2BookSnapshotCachePayload({
        data,
        activeBookCoin: 'ETH',
        activeOptions: {
          nSigFigs: 5,
          mantissa: 2,
        },
      }),
    ).toEqual({
      coin: 'ETH',
      data,
      nSigFigs: 5,
      mantissa: 2,
    });

    expect(
      buildL2BookSnapshotCachePayload({
        data,
        activeBookCoin: 'BTC',
        activeOptions: {
          nSigFigs: 5,
          mantissa: 2,
        },
      }),
    ).toEqual({
      coin: 'ETH',
      data,
      nSigFigs: null,
      mantissa: null,
    });
  });
});

describe('ServiceHyperliquidCache account display write throttle', () => {
  it('allows the first write and later writes outside the interval', () => {
    expect(
      shouldWritePerpsAccountDisplayCache({
        lastWriteAt: undefined,
        now: 1000,
        minIntervalMs: 5000,
      }),
    ).toBe(true);
    expect(
      shouldWritePerpsAccountDisplayCache({
        lastWriteAt: 1000,
        now: 6000,
        minIntervalMs: 5000,
      }),
    ).toBe(true);
  });

  it('skips repeated writes inside the interval', () => {
    expect(
      shouldWritePerpsAccountDisplayCache({
        lastWriteAt: 1000,
        now: 5999,
        minIntervalMs: 5000,
      }),
    ).toBe(false);
    expect(
      shouldWritePerpsAccountDisplayCache({
        lastWriteAt: 0,
        now: 4999,
        minIntervalMs: 5000,
      }),
    ).toBe(false);
  });
});
