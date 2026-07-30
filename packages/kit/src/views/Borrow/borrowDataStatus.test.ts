import {
  EBorrowDataStatus,
  deriveBorrowDataStatus,
  isBorrowReservesPending,
} from './borrowDataStatus';

const settledActiveState = {
  isViewActive: true,
  wasViewActive: true,
  hasCachedReserves: false,
  marketsLoading: false,
  hasMarket: true,
  hasFetchKey: true,
  shouldWaitForAccount: false,
  reservesLoading: false,
  isCurrentFetchKey: true,
  hasOwnedReservesResult: false,
  hasReservesError: false,
};

describe('deriveBorrowDataStatus', () => {
  it('reports the initial active market request as pending', () => {
    expect(
      deriveBorrowDataStatus({
        ...settledActiveState,
        marketsLoading: true,
        hasMarket: false,
      }),
    ).toBe(EBorrowDataStatus.LoadingMarkets);
  });

  it('keeps a cacheless market refresh pending even when a market is selected', () => {
    expect(
      deriveBorrowDataStatus({
        ...settledActiveState,
        marketsLoading: true,
        hasMarket: true,
      }),
    ).toBe(EBorrowDataStatus.LoadingMarkets);
  });

  it('keeps a market refresh pending when cached reserves have a stale owner', () => {
    expect(
      deriveBorrowDataStatus({
        ...settledActiveState,
        marketsLoading: true,
        hasCachedReserves: true,
        isCurrentFetchKey: false,
      }),
    ).toBe(EBorrowDataStatus.LoadingMarkets);
  });

  it('keeps current owned reserves visible during a market refresh', () => {
    expect(
      deriveBorrowDataStatus({
        ...settledActiveState,
        marketsLoading: true,
        hasCachedReserves: true,
      }),
    ).toBe(EBorrowDataStatus.Refreshing);
  });

  it('reports a cacheless inactive-to-active transition as pending', () => {
    expect(
      deriveBorrowDataStatus({
        ...settledActiveState,
        wasViewActive: false,
      }),
    ).toBe(EBorrowDataStatus.LoadingMarkets);
  });

  it('keeps cached reserves visible during inactive-to-active refresh', () => {
    expect(
      deriveBorrowDataStatus({
        ...settledActiveState,
        wasViewActive: false,
        hasCachedReserves: true,
        hasOwnedReservesResult: true,
      }),
    ).toBe(EBorrowDataStatus.Ready);
  });

  it('treats an empty owned reserves response as ready', () => {
    expect(
      deriveBorrowDataStatus({
        ...settledActiveState,
        hasOwnedReservesResult: true,
      }),
    ).toBe(EBorrowDataStatus.Ready);
  });

  it('keeps a changed scope pending before the loading flag updates', () => {
    expect(
      deriveBorrowDataStatus({
        ...settledActiveState,
        hasCachedReserves: true,
        isCurrentFetchKey: false,
      }),
    ).toBe(EBorrowDataStatus.LoadingReserves);
  });

  it('keeps a cacheless active scope pending before its request effect runs', () => {
    const status = deriveBorrowDataStatus(settledActiveState);

    expect(status).toBe(EBorrowDataStatus.LoadingReserves);
    expect(isBorrowReservesPending(status)).toBe(true);
  });

  it('reports an active request failure without cached data as an error', () => {
    const status = deriveBorrowDataStatus({
      ...settledActiveState,
      hasReservesError: true,
    });

    expect(status).toBe(EBorrowDataStatus.Error);
    expect(isBorrowReservesPending(status)).toBe(false);
  });

  it('keeps cached reserves visible when their refresh fails', () => {
    expect(
      deriveBorrowDataStatus({
        ...settledActiveState,
        hasCachedReserves: true,
        hasReservesError: true,
      }),
    ).toBe(EBorrowDataStatus.Ready);
  });

  it('keeps an inactive gate settled even without cached reserves', () => {
    expect(
      deriveBorrowDataStatus({
        ...settledActiveState,
        isViewActive: false,
        wasViewActive: false,
      }),
    ).toBe(EBorrowDataStatus.Idle);
  });
});

describe('isBorrowReservesPending', () => {
  it('keeps the provider initial state pending for all card and list consumers', () => {
    expect(isBorrowReservesPending(EBorrowDataStatus.Initializing)).toBe(true);
  });

  it.each([
    EBorrowDataStatus.LoadingMarkets,
    EBorrowDataStatus.WaitingForAccount,
    EBorrowDataStatus.LoadingReserves,
  ])('treats %s as pending without settled reserves', (status) => {
    expect(isBorrowReservesPending(status)).toBe(true);
  });

  it.each([
    EBorrowDataStatus.Idle,
    EBorrowDataStatus.Refreshing,
    EBorrowDataStatus.Ready,
    EBorrowDataStatus.Error,
  ])('treats %s as settled for rendering', (status) => {
    expect(isBorrowReservesPending(status)).toBe(false);
  });
});
