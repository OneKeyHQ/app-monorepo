import {
  getOwnedBorrowReservesResult,
  isCurrentBorrowReservesRequest,
} from './borrowDataGate.utils';

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
