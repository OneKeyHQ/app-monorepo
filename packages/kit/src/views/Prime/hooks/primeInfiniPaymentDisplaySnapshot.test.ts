import {
  isPrimeInfiniPaymentAccountSyncReady,
  resolvePrimeInfiniPaymentAsset,
  resolvePrimeInfiniPaymentDisplaySnapshot,
  resolvePrimeInfiniPaymentPinnedAssetKey,
  shouldShowPrimeInfiniExternalCheckoutLink,
  shouldShowPrimeInfiniPaymentButtonSkeleton,
} from './primeInfiniPaymentDisplaySnapshot';

const assets = [
  { key: 'sol-usdc', networkId: 'sol--101' },
  { key: 'eth-usdc', networkId: 'evm--1' },
  { key: 'bsc-usdt', networkId: 'evm--56' },
];

describe('resolvePrimeInfiniPaymentAsset', () => {
  it('prefers the selected or restored asset over the route network', () => {
    expect(
      resolvePrimeInfiniPaymentAsset({
        assets,
        selectedAssetKey: 'bsc-usdt',
        pendingAssetKey: 'eth-usdc',
        preferredNetworkId: 'sol--101',
      }),
    ).toBe(assets[2]);
    expect(
      resolvePrimeInfiniPaymentAsset({
        assets,
        selectedAssetKey: '',
        pendingAssetKey: 'bsc-usdt',
        preferredNetworkId: 'sol--101',
      }),
    ).toBe(assets[2]);
    expect(
      resolvePrimeInfiniPaymentAsset({
        assets,
        selectedAssetKey: 'unsupported-asset',
        pendingAssetKey: 'bsc-usdt',
        preferredNetworkId: 'sol--101',
      }),
    ).toBe(assets[2]);
  });

  it('uses the first supported asset on the preferred network', () => {
    expect(
      resolvePrimeInfiniPaymentAsset({
        assets,
        selectedAssetKey: '',
        preferredNetworkId: 'sol--101',
      }),
    ).toBe(assets[0]);
  });

  it('falls back to Ethereum and then the first backend asset', () => {
    expect(
      resolvePrimeInfiniPaymentAsset({
        assets,
        selectedAssetKey: '',
        preferredNetworkId: 'unsupported',
      }),
    ).toBe(assets[1]);
    expect(
      resolvePrimeInfiniPaymentAsset({
        assets: [assets[0], assets[2]],
        selectedAssetKey: '',
        preferredNetworkId: 'unsupported',
      }),
    ).toBe(assets[0]);
  });
});

describe('resolvePrimeInfiniPaymentPinnedAssetKey', () => {
  it('keeps the selected BSC token while an account reload temporarily loses its session', () => {
    const pinnedAssetKey = resolvePrimeInfiniPaymentPinnedAssetKey({
      selectedAssetKey: '',
      pendingAssetKey: 'bsc-usdt',
    });

    expect(
      resolvePrimeInfiniPaymentPinnedAssetKey({
        selectedAssetKey: pinnedAssetKey,
        pendingAssetKey: undefined,
      }),
    ).toBe('bsc-usdt');
  });

  it('lets an explicit token selection replace a restored session asset', () => {
    expect(
      resolvePrimeInfiniPaymentPinnedAssetKey({
        selectedAssetKey: 'eth-usdc',
        pendingAssetKey: 'bsc-usdt',
      }),
    ).toBe('eth-usdc');
  });
});

describe('isPrimeInfiniPaymentAccountSyncReady', () => {
  it('invalidates readiness synchronously when the selected token network changes', () => {
    expect(
      isPrimeInfiniPaymentAccountSyncReady({
        syncedNetworkId: 'evm--56',
        selectedNetworkId: 'evm--1',
      }),
    ).toBe(false);
    expect(
      isPrimeInfiniPaymentAccountSyncReady({
        syncedNetworkId: 'evm--56',
        selectedNetworkId: 'evm--56',
      }),
    ).toBe(true);
  });
});

describe('resolvePrimeInfiniPaymentDisplaySnapshot', () => {
  it('keeps the last ready account and asset together during account network sync', () => {
    const lastReadySelectionSnapshot = {
      accountId: 'account-a',
      assetKey: 'bsc-usdt',
      networkId: 'evm--56',
    };

    expect(
      resolvePrimeInfiniPaymentDisplaySnapshot({
        selectionSnapshot: {
          accountId: 'account-b',
          assetKey: 'bsc-usdt',
          networkId: 'evm--1',
        },
        lastReadySelectionSnapshot,
        isSelectionReady: false,
        payment: undefined,
        isPaymentCurrent: false,
      }),
    ).toEqual({
      selectionSnapshot: lastReadySelectionSnapshot,
      payment: undefined,
    });
  });

  it('commits the new account and asset together once their network is ready', () => {
    const selectionSnapshot = {
      accountId: 'account-b',
      assetKey: 'bsc-usdt',
      networkId: 'evm--56',
    };

    expect(
      resolvePrimeInfiniPaymentDisplaySnapshot({
        selectionSnapshot,
        lastReadySelectionSnapshot: {
          accountId: 'account-a',
          assetKey: 'bsc-usdt',
          networkId: 'evm--56',
        },
        isSelectionReady: true,
        payment: undefined,
        isPaymentCurrent: false,
      }),
    ).toEqual({
      selectionSnapshot,
      payment: undefined,
    });
  });

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
