import { isCurrentBorrowReservesRequest } from './borrowDataGate.utils';

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
