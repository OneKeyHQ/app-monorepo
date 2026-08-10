import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IBook } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  perpsActiveAccountSummaryAtom,
  perpsSpotBalancesAtom,
} from '../../states/jotai/atoms';
import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';

import ServiceHyperliquidCache, {
  buildL2BookSnapshotCachePayload,
  getL2BookSnapshotCacheEntryLevelCount,
  getL2BookSnapshotSwrCache,
  selectL2BookSnapshotCacheEntry,
  shouldWritePerpsAccountDisplayCache,
} from './ServiceHyperliquidCache';

import type { IPerpsL2BookSnapshotCacheEntry } from '../../dbs/simple/entity/SimpleDbEntityPerp';

jest.mock('../../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: jest.fn().mockResolvedValue({ enabled: true }),
  },
}));

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
  afterEach(() => {
    swrCacheUtils.clearAll();
    swrCacheUtils.flushNow();
  });

  it('counts the shallower side of the cached L2 book', () => {
    expect(
      getL2BookSnapshotCacheEntryLevelCount(
        buildEntry({ updatedAt: 1, bidLevels: 20, askLevels: 12 }),
      ),
    ).toBe(12);
  });

  it('selects the newest two-sided L2 book even when the market is shallow', () => {
    const simpleDbEntry = buildEntry({
      updatedAt: 100,
      bidLevels: 18,
      askLevels: 18,
    });
    const newerShallowSwrEntry = buildEntry({
      updatedAt: 200,
      bidLevels: 25,
      askLevels: 4,
    });

    expect(
      selectL2BookSnapshotCacheEntry({
        simpleDbEntry,
        swrEntry: newerShallowSwrEntry,
      }),
    ).toBe(newerShallowSwrEntry);
  });

  it('rejects snapshots with an empty side', () => {
    const validEntry = buildEntry({
      updatedAt: 100,
      bidLevels: 1,
      askLevels: 1,
    });
    const newerOneSidedEntry = buildEntry({
      updatedAt: 200,
      bidLevels: 25,
      askLevels: 0,
    });

    expect(
      selectL2BookSnapshotCacheEntry({
        simpleDbEntry: validEntry,
        swrEntry: newerOneSidedEntry,
      }),
    ).toBe(validEntry);
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

  it('uses the source precision instead of current UI options', () => {
    const data = Object.assign(
      buildBook({ coin: 'ETH', bidLevels: 20, askLevels: 20 }),
      { nSigFigs: 5, mantissa: 5 },
    );

    expect(
      buildL2BookSnapshotCachePayload({
        data,
        activeBookCoin: 'ETH',
        activeOptions: { nSigFigs: 5, mantissa: 2 },
      }),
    ).toMatchObject({ nSigFigs: 5, mantissa: 5 });
  });

  it('rejects a latest snapshot cached for another precision', () => {
    const data = Object.assign(
      buildBook({ coin: 'ETH', bidLevels: 20, askLevels: 20 }),
      { nSigFigs: 5, mantissa: 5 },
    );
    swrCacheUtils.set(swrKeys.perpsL2BookSnapshotLatest({ coin: 'ETH' }), data);

    expect(
      getL2BookSnapshotSwrCache({
        coin: 'ETH',
        nSigFigs: 5,
        mantissa: 2,
        maxAgeMs: 60_000,
      }),
    ).toBeUndefined();
  });

  it('preserves source precision when using an untargeted latest snapshot', () => {
    const data = Object.assign(
      buildBook({ coin: 'ETH', bidLevels: 20, askLevels: 20 }),
      { nSigFigs: 5, mantissa: 5 },
    );
    swrCacheUtils.set(swrKeys.perpsL2BookSnapshotLatest({ coin: 'ETH' }), data);

    expect(
      getL2BookSnapshotSwrCache({
        coin: 'ETH',
        maxAgeMs: 60_000,
      }),
    ).toMatchObject({
      data,
      nSigFigs: 5,
      mantissa: 5,
    });
  });
});

describe('ServiceHyperliquidCache L2 book runtime cache', () => {
  afterEach(() => {
    delete (
      globalThis as typeof globalThis & {
        $onekeyIsInBackground?: boolean;
      }
    ).$onekeyIsInBackground;
    jest.useRealTimers();
    swrCacheUtils.clearAll();
    swrCacheUtils.flushNow();
  });

  function createService() {
    (
      globalThis as typeof globalThis & {
        $onekeyIsInBackground?: boolean;
      }
    ).$onekeyIsInBackground = true;
    const getL2BookSnapshotCache = jest.fn().mockResolvedValue(undefined);
    const setL2BookSnapshotCaches = jest.fn().mockResolvedValue(undefined);
    const clearPerpsColdStartCache = jest.fn().mockResolvedValue(undefined);
    const invalidateHyperliquidPortfolio = jest
      .fn()
      .mockResolvedValue(undefined);
    const service = new ServiceHyperliquidCache({
      backgroundApi: {
        simpleDb: {
          perp: {
            getL2BookSnapshotCache,
            setL2BookSnapshotCaches,
            clearPerpsColdStartCache,
          },
        },
        serviceHyperliquid: {
          invalidateHyperliquidPortfolio,
        },
      },
    });
    return {
      service,
      getL2BookSnapshotCache,
      setL2BookSnapshotCaches,
      clearPerpsColdStartCache,
      invalidateHyperliquidPortfolio,
    };
  }

  it('serves the exact hot target without waiting for persisted storage', async () => {
    const { service, getL2BookSnapshotCache } = createService();
    const data = Object.assign(
      buildBook({ coin: 'ETH', bidLevels: 4, askLevels: 4 }),
      { nSigFigs: 5, mantissa: 2 },
    );

    service.cacheL2BookSnapshot({
      data,
      activeBookCoin: 'ETH',
      activeOptions: { nSigFigs: 5, mantissa: 2 },
    });

    await expect(
      service.getL2BookSnapshotCache({
        coin: 'ETH',
        nSigFigs: 5,
        mantissa: 2,
      }),
    ).resolves.toMatchObject({
      coin: 'ETH',
      nSigFigs: 5,
      mantissa: 2,
      isCachedSnapshot: true,
    });
    expect(getL2BookSnapshotCache).not.toHaveBeenCalled();
  });

  it('keeps one pending snapshot per target during rapid switches', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T00:00:00.000Z'));
    const { service, setL2BookSnapshotCaches } = createService();
    const cache = (coin: string, bidPrice: string) => {
      const data = buildBook({ coin, bidLevels: 4, askLevels: 4 });
      data.levels[0][0] = { px: bidPrice, sz: '1', n: 1 };
      service.cacheL2BookSnapshot({
        data,
        activeBookCoin: coin,
        activeOptions: { nSigFigs: 5, mantissa: null },
      });
    };

    cache('BTC', '100');
    cache('ETH', '200');
    cache('SOL', '300');
    cache('ETH', '201');
    service.flushPendingL2BookSnapshotCache();

    expect(setL2BookSnapshotCaches).toHaveBeenCalledTimes(2);
    expect(setL2BookSnapshotCaches.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({
        coin: 'ETH',
        data: expect.objectContaining({
          levels: expect.arrayContaining([
            expect.arrayContaining([expect.objectContaining({ px: '201' })]),
          ]),
        }),
      }),
      expect.objectContaining({ coin: 'SOL' }),
    ]);
  });

  it('rejects cache clearing when developer settings are disabled', async () => {
    jest
      .mocked(devSettingsPersistAtom.get)
      .mockResolvedValueOnce({ enabled: false });
    const {
      service,
      clearPerpsColdStartCache,
      invalidateHyperliquidPortfolio,
    } = createService();

    await expect(service.clearPerpsColdStartCacheForDev()).rejects.toThrow(
      'only available when devSettings is enabled',
    );
    expect(clearPerpsColdStartCache).not.toHaveBeenCalled();
    expect(invalidateHyperliquidPortfolio).not.toHaveBeenCalled();
  });

  it('clears every runtime layer and blocks cache writes until restart', async () => {
    globalJotaiStorageReadyHandler.resolveReady(true);
    const {
      service,
      getL2BookSnapshotCache,
      setL2BookSnapshotCaches,
      clearPerpsColdStartCache,
      invalidateHyperliquidPortfolio,
    } = createService();
    const data = buildBook({ coin: 'ETH', bidLevels: 4, askLevels: 4 });
    const unrelatedKey = 'historyTxDetail:v1:account:tx';
    swrCacheUtils.set(swrKeys.perpsL2BookSnapshotLatest({ coin: 'ETH' }), data);
    swrCacheUtils.set(unrelatedKey, { keep: true });
    service.cacheL2BookSnapshot({
      data,
      activeBookCoin: 'ETH',
      activeOptions: { nSigFigs: 5, mantissa: 2 },
    });

    await service.clearPerpsColdStartCacheForDev();

    expect(invalidateHyperliquidPortfolio).toHaveBeenCalledTimes(1);
    expect(clearPerpsColdStartCache).toHaveBeenCalledTimes(1);
    expect(
      swrCacheUtils.get(swrKeys.perpsL2BookSnapshotLatest({ coin: 'ETH' })),
    ).toBeUndefined();
    expect(swrCacheUtils.get(unrelatedKey)).toEqual({ keep: true });

    getL2BookSnapshotCache.mockClear();
    await expect(
      service.getL2BookSnapshotCache({
        coin: 'ETH',
        nSigFigs: 5,
        mantissa: 2,
      }),
    ).resolves.toBeUndefined();
    expect(getL2BookSnapshotCache).toHaveBeenCalledTimes(1);

    setL2BookSnapshotCaches.mockClear();
    service.cacheL2BookSnapshot({
      data,
      activeBookCoin: 'ETH',
      activeOptions: { nSigFigs: 5, mantissa: 2 },
    });
    service.flushPendingL2BookSnapshotCache();
    expect(setL2BookSnapshotCaches).not.toHaveBeenCalled();
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

describe('ServiceHyperliquidCache account display hydration', () => {
  beforeAll(() => {
    globalJotaiStorageReadyHandler.resolveReady(true);
    (
      globalThis as typeof globalThis & {
        $onekeyIsInBackground?: boolean;
      }
    ).$onekeyIsInBackground = true;
  });

  afterAll(() => {
    delete (
      globalThis as typeof globalThis & {
        $onekeyIsInBackground?: boolean;
      }
    ).$onekeyIsInBackground;
  });

  it('does not apply cached account data after the request is superseded', async () => {
    const previousSummary: NonNullable<
      Awaited<ReturnType<typeof perpsActiveAccountSummaryAtom.get>>
    > = {
      accountAddress: '0xprevious',
      accountValue: '1',
      totalMarginUsed: undefined,
      crossAccountValue: undefined,
      crossMaintenanceMarginUsed: undefined,
      totalNtlPos: undefined,
      totalRawUsd: undefined,
      withdrawable: undefined,
      totalUnrealizedPnl: undefined,
    };
    const previousSpot: NonNullable<
      Awaited<ReturnType<typeof perpsSpotBalancesAtom.get>>
    > = {
      accountAddress: '0xprevious',
      balances: [],
      spotTotalUsd: '1',
    };
    await perpsActiveAccountSummaryAtom.set(previousSummary);
    await perpsSpotBalancesAtom.set(previousSpot);

    const service = new ServiceHyperliquidCache({
      backgroundApi: {
        simpleDb: {
          perp: {
            getUserAbstractionMode: jest.fn().mockResolvedValue(undefined),
            getPerpsAccountDisplayCache: jest.fn().mockResolvedValue({
              summary: {
                data: {
                  ...previousSummary,
                  accountAddress: '0xtarget',
                  accountValue: '2',
                },
                updatedAt: Date.now(),
              },
              spotBalances: {
                data: {
                  accountAddress: '0xtarget',
                  balances: [],
                  spotTotalUsd: '2',
                },
                updatedAt: Date.now(),
              },
            }),
          },
        },
      },
    });

    const hydrateWithGuard = service.hydratePerpsAccountDisplayCache.bind(
      service,
    ) as unknown as (
      accountAddress: string,
      shouldApply: () => boolean,
    ) => Promise<void>;
    await hydrateWithGuard('0xtarget', () => false);

    await expect(perpsActiveAccountSummaryAtom.get()).resolves.toEqual(
      previousSummary,
    );
    await expect(perpsSpotBalancesAtom.get()).resolves.toEqual(previousSpot);
  });
});
