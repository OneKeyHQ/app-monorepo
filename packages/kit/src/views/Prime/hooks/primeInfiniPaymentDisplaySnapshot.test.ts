import {
  resolvePrimeInfiniPaymentDisplaySnapshot,
  shouldShowPrimeInfiniExternalCheckoutLink,
  shouldShowPrimeInfiniPaymentButtonSkeleton,
} from './primeInfiniPaymentDisplaySnapshot';

describe('resolvePrimeInfiniPaymentDisplaySnapshot', () => {
  it('switches local selection immediately while hiding a stale payment quote', () => {
    const selectionSnapshot = {
      accountId: 'account-2',
      assetKey: 'sol-usdc',
      balance: '2',
    };

    expect(
      resolvePrimeInfiniPaymentDisplaySnapshot({
        selectionSnapshot,
        payment: {
          paymentId: 'payment-1',
          amountDue: '0.2',
        },
        isPaymentCurrent: false,
      }),
    ).toEqual({
      selectionSnapshot,
      payment: undefined,
    });
  });

  it('shows the payment quote only after it matches the current selection', () => {
    const selectionSnapshot = {
      accountId: 'account-2',
      assetKey: 'sol-usdc',
      balance: '2',
    };
    const payment = {
      paymentId: 'payment-2',
      amountDue: '0.3',
    };

    expect(
      resolvePrimeInfiniPaymentDisplaySnapshot({
        selectionSnapshot,
        payment,
        isPaymentCurrent: true,
      }),
    ).toEqual({
      selectionSnapshot,
      payment,
    });
  });
});

describe('shouldShowPrimeInfiniPaymentButtonSkeleton', () => {
  it('keeps the full button skeleton while local prerequisites are loading', () => {
    expect(
      shouldShowPrimeInfiniPaymentButtonSkeleton({
        hasCurrentPayment: true,
        isOptionsRefreshing: false,
        isBalanceLoading: true,
        accountSyncReady: true,
        accountSyncFailed: false,
      }),
    ).toBe(true);
    expect(
      shouldShowPrimeInfiniPaymentButtonSkeleton({
        hasCurrentPayment: true,
        isOptionsRefreshing: false,
        isBalanceLoading: false,
        accountSyncReady: false,
        accountSyncFailed: false,
      }),
    ).toBe(true);
  });

  it('shows the real disabled button for a terminal local-data failure', () => {
    expect(
      shouldShowPrimeInfiniPaymentButtonSkeleton({
        hasCurrentPayment: true,
        isOptionsRefreshing: false,
        isBalanceLoading: false,
        accountSyncReady: false,
        accountSyncFailed: true,
      }),
    ).toBe(false);
  });

  it('shows the real button after the quote and local prerequisites are ready', () => {
    expect(
      shouldShowPrimeInfiniPaymentButtonSkeleton({
        hasCurrentPayment: true,
        isOptionsRefreshing: false,
        isBalanceLoading: false,
        accountSyncReady: true,
        accountSyncFailed: false,
      }),
    ).toBe(false);
  });
});

describe('shouldShowPrimeInfiniExternalCheckoutLink', () => {
  it('keeps the link hidden until the payment button skeleton is gone', () => {
    expect(
      shouldShowPrimeInfiniExternalCheckoutLink({
        canUseExternalCheckout: true,
        isPaymentButtonPreparing: true,
      }),
    ).toBe(false);
    expect(
      shouldShowPrimeInfiniExternalCheckoutLink({
        canUseExternalCheckout: true,
        isPaymentButtonPreparing: false,
      }),
    ).toBe(true);
  });

  it('keeps the link hidden when external checkout is unavailable', () => {
    expect(
      shouldShowPrimeInfiniExternalCheckoutLink({
        canUseExternalCheckout: false,
        isPaymentButtonPreparing: false,
      }),
    ).toBe(false);
  });
});
