import { EBorrowDataStatus } from '../borrowDataStatus';

import {
  isBorrowMarketChangeCancelled,
  isBorrowMarketChangeSettled,
} from './Markets.utils';

describe('isBorrowMarketChangeCancelled', () => {
  const marketKey = 'aave-evm--1-market-a';

  it('cancels when the target is neither requested nor visible', () => {
    expect(
      isBorrowMarketChangeCancelled({
        targetMarketKey: marketKey,
        requestedMarketKey: undefined,
        currentMarketKey: 'aave-evm--1-market-b',
      }),
    ).toBe(true);
  });

  it('keeps waiting while the target is requested', () => {
    expect(
      isBorrowMarketChangeCancelled({
        targetMarketKey: marketKey,
        requestedMarketKey: marketKey,
        currentMarketKey: 'aave-evm--1-market-b',
      }),
    ).toBe(false);
  });

  it('lets the settled-state check finish a published target', () => {
    expect(
      isBorrowMarketChangeCancelled({
        targetMarketKey: marketKey,
        requestedMarketKey: undefined,
        currentMarketKey: marketKey,
      }),
    ).toBe(false);
  });
});

describe('isBorrowMarketChangeSettled', () => {
  const marketKey = 'aave-evm--1-market-a';

  it('waits through unresolved and loading states for the target market', () => {
    const statuses = [
      EBorrowDataStatus.Idle,
      EBorrowDataStatus.WaitingForAccount,
      EBorrowDataStatus.LoadingReserves,
      EBorrowDataStatus.Refreshing,
    ];

    statuses.forEach((dataStatus) => {
      expect(
        isBorrowMarketChangeSettled({
          targetMarketKey: marketKey,
          currentMarketKey: marketKey,
          reservesOwnerMarketKey: marketKey,
          dataStatus,
        }),
      ).toBe(false);
    });
  });

  it.each([EBorrowDataStatus.Ready, EBorrowDataStatus.Error])(
    'settles at the target market terminal state: %s',
    (dataStatus) => {
      expect(
        isBorrowMarketChangeSettled({
          targetMarketKey: marketKey,
          currentMarketKey: marketKey,
          reservesOwnerMarketKey: marketKey,
          dataStatus,
        }),
      ).toBe(true);
    },
  );

  it('does not settle data owned by the previous market', () => {
    expect(
      isBorrowMarketChangeSettled({
        targetMarketKey: marketKey,
        currentMarketKey: marketKey,
        reservesOwnerMarketKey: 'aave-evm--1-market-b',
        dataStatus: EBorrowDataStatus.Ready,
      }),
    ).toBe(false);
  });
});
