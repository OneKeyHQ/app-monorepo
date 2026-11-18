import { EBorrowDataStatus } from '../borrowDataStatus';

import {
  BORROW_DISPLAY_CACHE_MAX_AGE,
  getBorrowReservesDataToPublish,
  getBorrowStatusWhileTargetMetricsLoad,
  getOwnedBorrowReservesResult,
  isBorrowEarnAccountLoading,
  isBorrowSnapshotReusable,
  isCurrentBorrowReservesRequest,
  isPreviousBorrowReservesSnapshotAvailable,
  shouldHoldBorrowMarketSkeleton,
  shouldPublishBorrowMarketChange,
  shouldRefreshBorrowDataOnActivation,
} from './borrowDataGate.utils';

describe('getBorrowStatusWhileTargetMetricsLoad', () => {
  it('keeps a partly preloaded target hidden until its metrics settle', () => {
    const pendingStatus = getBorrowStatusWhileTargetMetricsLoad({
      reservesStatus: EBorrowDataStatus.Refreshing,
      areTargetMetricsPending: true,
    });
    expect(pendingStatus).toBe(EBorrowDataStatus.LoadingReserves);
    expect(
      shouldPublishBorrowMarketChange({
        isMarketChangePending: true,
        dataStatus: pendingStatus,
        hasOwnedReservesResult: true,
      }),
    ).toBe(false);
    expect(
      getBorrowStatusWhileTargetMetricsLoad({
        reservesStatus: EBorrowDataStatus.Refreshing,
        areTargetMetricsPending: false,
      }),
    ).toBe(EBorrowDataStatus.Refreshing);
  });
});

describe('isBorrowEarnAccountLoading', () => {
  it.each([undefined, false, true])(
    'keeps an unresolved target account pending when request loading is %s',
    (isLoading) => {
      expect(
        isBorrowEarnAccountLoading({
          isLoading,
          hasAccountContext: true,
          hasMarketNetwork: true,
          isAccountUnresolved: true,
        }),
      ).toBe(true);
    },
  );

  it.each([
    {
      hasAccountContext: false,
      hasMarketNetwork: true,
      isAccountUnresolved: true,
    },
    {
      hasAccountContext: true,
      hasMarketNetwork: false,
      isAccountUnresolved: true,
    },
    {
      hasAccountContext: true,
      hasMarketNetwork: true,
      isAccountUnresolved: false,
    },
  ])(
    'does not mark a settled or absent account scope as loading: %j',
    (scope) => {
      expect(isBorrowEarnAccountLoading({ isLoading: false, ...scope })).toBe(
        false,
      );
    },
  );
});

describe('shouldPublishBorrowMarketChange', () => {
  it.each([EBorrowDataStatus.Initializing, EBorrowDataStatus.Idle])(
    'keeps the visible market stable before target loading starts: %s',
    (dataStatus) => {
      expect(
        shouldPublishBorrowMarketChange({
          isMarketChangePending: true,
          dataStatus,
        }),
      ).toBe(false);
    },
  );

  it.each([
    EBorrowDataStatus.LoadingMarkets,
    EBorrowDataStatus.WaitingForAccount,
    EBorrowDataStatus.LoadingReserves,
    EBorrowDataStatus.Refreshing,
  ])(
    'keeps the visible market stable while target data is %s',
    (dataStatus) => {
      expect(
        shouldPublishBorrowMarketChange({
          isMarketChangePending: true,
          dataStatus,
        }),
      ).toBe(false);
    },
  );

  it('publishes an error so the requested market can show its retry state', () => {
    expect(
      shouldPublishBorrowMarketChange({
        isMarketChangePending: true,
        dataStatus: EBorrowDataStatus.Error,
      }),
    ).toBe(true);
  });

  it('publishes a ready target only with reusable owned reserves', () => {
    expect(
      shouldPublishBorrowMarketChange({
        isMarketChangePending: true,
        dataStatus: EBorrowDataStatus.Ready,
      }),
    ).toBe(false);
    expect(
      shouldPublishBorrowMarketChange({
        isMarketChangePending: true,
        dataStatus: EBorrowDataStatus.Ready,
        hasOwnedReservesResult: true,
      }),
    ).toBe(true);
  });

  it('keeps same-market refreshes publishable', () => {
    expect(
      shouldPublishBorrowMarketChange({
        isMarketChangePending: false,
        dataStatus: EBorrowDataStatus.Refreshing,
      }),
    ).toBe(true);
  });

  it('publishes cached target reserves while refreshing them', () => {
    expect(
      shouldPublishBorrowMarketChange({
        isMarketChangePending: true,
        dataStatus: EBorrowDataStatus.Refreshing,
        hasOwnedReservesResult: true,
      }),
    ).toBe(true);
  });

  it('publishes a target skeleton after the switch delay', () => {
    expect(
      shouldPublishBorrowMarketChange({
        isMarketChangePending: true,
        dataStatus: EBorrowDataStatus.LoadingReserves,
        showDelayedSkeleton: true,
      }),
    ).toBe(true);
  });
});

describe('isBorrowSnapshotReusable', () => {
  const now = 2_000_000;

  it('keeps a same-account snapshot visible during weak-network refresh', () => {
    expect(
      isBorrowSnapshotReusable({
        updatedAt: now - 61_000,
        now,
        isAccountCacheReusable: true,
      }),
    ).toBe(true);
  });

  it('rejects obsolete, invalidated, and future snapshots', () => {
    for (const [updatedAt, isAccountCacheReusable] of [
      [now - BORROW_DISPLAY_CACHE_MAX_AGE, true],
      [now - 1000, false],
      [now + 1, true],
    ] as const) {
      expect(
        isBorrowSnapshotReusable({
          updatedAt,
          now,
          isAccountCacheReusable,
        }),
      ).toBe(false);
    }
  });
});

describe('isPreviousBorrowReservesSnapshotAvailable', () => {
  it('keeps a same-scope snapshot available while focus refreshes it', () => {
    expect(
      isPreviousBorrowReservesSnapshotAvailable({
        previousData: { market: 'aave' },
        previousFetchKey: 'aave-account',
        currentFetchKey: 'aave-account',
        updatedAt: 1000,
        now: 2000,
        isAccountCacheReusable: true,
      }),
    ).toBe(true);
  });

  it.each([
    {
      previousData: null,
      previousFetchKey: 'aave-account',
      currentFetchKey: 'aave-account',
      updatedAt: 1000,
      now: 2000,
      isAccountCacheReusable: true,
    },
    {
      previousData: { market: 'old' },
      previousFetchKey: 'old-account',
      currentFetchKey: 'new-account',
      updatedAt: 1000,
      now: 2000,
      isAccountCacheReusable: true,
    },
    {
      previousData: { market: 'aave' },
      previousFetchKey: 'aave-account',
      currentFetchKey: 'aave-account',
      updatedAt: 1000,
      now: 2000,
      isAccountCacheReusable: false,
    },
  ])('rejects an unsafe previous snapshot: %j', (input) => {
    expect(isPreviousBorrowReservesSnapshotAvailable(input)).toBe(false);
  });

  it('rejects a same-scope snapshot after the display cache expires', () => {
    expect(
      isPreviousBorrowReservesSnapshotAvailable({
        previousData: { market: 'aave' },
        previousFetchKey: 'aave-account',
        currentFetchKey: 'aave-account',
        updatedAt: 2000 - BORROW_DISPLAY_CACHE_MAX_AGE,
        now: 2000,
        isAccountCacheReusable: true,
      }),
    ).toBe(false);
  });
});

describe('shouldHoldBorrowMarketSkeleton', () => {
  const base = {
    skeletonMarketKey: 'market-b',
    skeletonStartedAt: 1000,
    targetMarketKey: 'market-b',
    requestedMarketKey: undefined,
  };

  it('holds the target skeleton for its minimum duration', () => {
    expect(shouldHoldBorrowMarketSkeleton({ ...base, now: 1299 })).toBe(true);
    expect(shouldHoldBorrowMarketSkeleton({ ...base, now: 1300 })).toBe(false);
  });

  it('keeps the target skeleton after its minimum while target data is pending', () => {
    expect(
      shouldHoldBorrowMarketSkeleton({
        ...base,
        isTargetLoading: true,
        now: 2000,
      }),
    ).toBe(true);
    expect(
      shouldHoldBorrowMarketSkeleton({
        ...base,
        isTargetLoading: false,
        now: 2000,
      }),
    ).toBe(false);
  });

  it('does not hold a replaced or cancelled target', () => {
    expect(
      shouldHoldBorrowMarketSkeleton({
        ...base,
        requestedMarketKey: 'market-c',
        now: 1100,
      }),
    ).toBe(false);
    expect(
      shouldHoldBorrowMarketSkeleton({
        ...base,
        targetMarketKey: 'market-a',
        now: 1100,
      }),
    ).toBe(false);
  });
});

describe('getBorrowReservesDataToPublish', () => {
  const oldMarket = { market: 'old' };
  const targetMarket = { market: 'target' };

  it('keeps unusable target data out of the visible snapshot', () => {
    expect(
      getBorrowReservesDataToPublish({
        previousData: oldMarket,
        ownedData: targetMarket,
        hasReusableOwnedData: false,
        isFetchKeyChanged: true,
        dataStatus: EBorrowDataStatus.LoadingReserves,
      }),
    ).toBeNull();
  });

  it('uses the target data in the Refreshing render that publishes its market', () => {
    expect(
      getBorrowReservesDataToPublish({
        previousData: null,
        ownedData: targetMarket,
        hasReusableOwnedData: true,
        isFetchKeyChanged: false,
        dataStatus: EBorrowDataStatus.Refreshing,
      }),
    ).toBe(targetMarket);
  });
});

describe('isCurrentBorrowReservesRequest', () => {
  it('accepts only the latest request for the active market owner', () => {
    expect(
      isCurrentBorrowReservesRequest({
        requestKey: 'aave-evm--1-market-a-account',
        currentKey: 'aave-evm--1-market-a-account',
        requestId: 2,
        currentRequestId: 2,
      }),
    ).toBe(true);

    expect(
      isCurrentBorrowReservesRequest({
        requestKey: 'aave-evm--1-market-a-account',
        currentKey: 'aave-evm--1-market-b-account',
        requestId: 1,
        currentRequestId: 2,
      }),
    ).toBe(false);

    expect(
      isCurrentBorrowReservesRequest({
        requestKey: 'aave-evm--1-market-b-account',
        currentKey: 'aave-evm--1-market-b-account',
        requestId: 1,
        currentRequestId: 2,
      }),
    ).toBe(false);
  });
});

describe('getOwnedBorrowReservesResult', () => {
  const reserves = { overview: { netWorth: 'market-a' } };

  it('publishes a result only to the fetch key that owns it', () => {
    expect(
      getOwnedBorrowReservesResult({
        result: reserves,
        resultOwnerKey: 'aave-evm--1-market-a-account',
        currentKey: 'aave-evm--1-market-a-account',
      }),
    ).toBe(reserves);

    expect(
      getOwnedBorrowReservesResult({
        result: reserves,
        resultOwnerKey: 'aave-evm--1-market-a-account',
        currentKey: 'aave-evm--1-market-b-account',
      }),
    ).toBeUndefined();
  });

  it('does not publish an unowned result while the market is unresolved', () => {
    expect(
      getOwnedBorrowReservesResult({
        result: reserves,
        resultOwnerKey: null,
        currentKey: null,
      }),
    ).toBeUndefined();
  });
});

describe('shouldRefreshBorrowDataOnActivation', () => {
  it('does not duplicate the hooks initial active fetch', () => {
    expect(
      shouldRefreshBorrowDataOnActivation({
        isViewActive: true,
        wasViewActive: true,
      }),
    ).toBe(false);
  });

  it('refreshes after a real inactive-to-active transition', () => {
    expect(
      shouldRefreshBorrowDataOnActivation({
        isViewActive: true,
        wasViewActive: false,
      }),
    ).toBe(true);
  });
});
