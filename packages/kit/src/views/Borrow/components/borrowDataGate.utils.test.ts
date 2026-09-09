import { EBorrowDataStatus } from '../borrowDataStatus';

import {
  getOwnedBorrowReservesResult,
  isCurrentBorrowReservesRequest,
  shouldPublishBorrowMarketChange,
  shouldRefreshBorrowDataOnActivation,
} from './borrowDataGate.utils';

describe('shouldPublishBorrowMarketChange', () => {
  it.each([
    EBorrowDataStatus.Initializing,
    EBorrowDataStatus.Idle,
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

  it.each([EBorrowDataStatus.Ready, EBorrowDataStatus.Error])(
    'publishes the target market at terminal status %s',
    (dataStatus) => {
      expect(
        shouldPublishBorrowMarketChange({
          isMarketChangePending: true,
          dataStatus,
        }),
      ).toBe(true);
    },
  );

  it('keeps same-market refreshes publishable', () => {
    expect(
      shouldPublishBorrowMarketChange({
        isMarketChangePending: false,
        dataStatus: EBorrowDataStatus.Refreshing,
      }),
    ).toBe(true);
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
