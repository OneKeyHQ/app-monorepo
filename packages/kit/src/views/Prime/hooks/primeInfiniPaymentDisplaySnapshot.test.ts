import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

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
  it.each([
    { scenario: 'an empty wallet list', accountId: undefined },
    { scenario: 'a watch-only account', accountId: 'watching--0--account' },
    { scenario: 'an external account', accountId: 'external--0--account' },
  ])('stops loading after account sync for $scenario', ({ accountId }) => {
    const preparationState = {
      hasPaymentAccount: Boolean(
        accountId && accountUtils.isOwnAccount({ accountId }),
      ),
      hasCurrentPayment: false,
      isOptionsRefreshing: false,
      isBalanceLoading: false,
      accountSyncReady: true,
      accountSyncFailed: false,
    };

    expect(shouldShowPrimeInfiniPaymentButtonSkeleton(preparationState)).toBe(
      false,
    );
    expect(
      shouldShowPrimeInfiniExternalCheckoutLink({
        canUseExternalCheckout: true,
        isOptionsRefreshing: preparationState.isOptionsRefreshing,
      }),
    ).toBe(true);
  });

  it('keeps loading until account sync can determine whether an account is available', () => {
    expect(
      shouldShowPrimeInfiniPaymentButtonSkeleton({
        hasPaymentAccount: false,
        hasCurrentPayment: false,
        isOptionsRefreshing: false,
        isBalanceLoading: false,
        accountSyncReady: false,
        accountSyncFailed: false,
      }),
    ).toBe(true);
  });

  it('keeps loading while payment options refresh without an account', () => {
    expect(
      shouldShowPrimeInfiniPaymentButtonSkeleton({
        hasPaymentAccount: false,
        hasCurrentPayment: false,
        isOptionsRefreshing: true,
        isBalanceLoading: false,
        accountSyncReady: true,
        accountSyncFailed: false,
      }),
    ).toBe(true);
  });

  it('keeps loading while a supported account waits for its quote', () => {
    expect(
      shouldShowPrimeInfiniPaymentButtonSkeleton({
        hasPaymentAccount: true,
        hasCurrentPayment: false,
        isOptionsRefreshing: false,
        isBalanceLoading: false,
        accountSyncReady: true,
        accountSyncFailed: false,
      }),
    ).toBe(true);
  });

  it('keeps the full button skeleton while local prerequisites are loading', () => {
    expect(
      shouldShowPrimeInfiniPaymentButtonSkeleton({
        hasPaymentAccount: true,
        hasCurrentPayment: true,
        isOptionsRefreshing: false,
        isBalanceLoading: true,
        accountSyncReady: true,
        accountSyncFailed: false,
      }),
    ).toBe(true);
    expect(
      shouldShowPrimeInfiniPaymentButtonSkeleton({
        hasPaymentAccount: true,
        hasCurrentPayment: true,
        isOptionsRefreshing: false,
        isBalanceLoading: false,
        accountSyncReady: false,
        accountSyncFailed: false,
      }),
    ).toBe(true);
  });

  it.each([false, true])(
    'shows the real disabled button after account sync fails, with payment: %s',
    (hasCurrentPayment) => {
      expect(
        shouldShowPrimeInfiniPaymentButtonSkeleton({
          hasPaymentAccount: true,
          hasCurrentPayment,
          isOptionsRefreshing: false,
          isBalanceLoading: false,
          accountSyncReady: false,
          accountSyncFailed: true,
        }),
      ).toBe(false);
    },
  );

  it('shows the real button after the quote and local prerequisites are ready', () => {
    expect(
      shouldShowPrimeInfiniPaymentButtonSkeleton({
        hasPaymentAccount: true,
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
  it('shows the link without a compatible wallet account or payment quote', () => {
    const preparationState = {
      hasPaymentAccount: false,
      hasCurrentPayment: false,
      isOptionsRefreshing: false,
      isBalanceLoading: false,
      accountSyncReady: true,
      accountSyncFailed: false,
    };

    expect(shouldShowPrimeInfiniPaymentButtonSkeleton(preparationState)).toBe(
      false,
    );
    expect(
      shouldShowPrimeInfiniExternalCheckoutLink({
        canUseExternalCheckout: true,
        isOptionsRefreshing: preparationState.isOptionsRefreshing,
      }),
    ).toBe(true);
  });

  it('shows the link while the wallet balance is loading', () => {
    const preparationState = {
      hasPaymentAccount: true,
      hasCurrentPayment: true,
      isOptionsRefreshing: false,
      isBalanceLoading: true,
      accountSyncReady: true,
      accountSyncFailed: false,
    };

    expect(shouldShowPrimeInfiniPaymentButtonSkeleton(preparationState)).toBe(
      true,
    );
    expect(
      shouldShowPrimeInfiniExternalCheckoutLink({
        canUseExternalCheckout: true,
        isOptionsRefreshing: preparationState.isOptionsRefreshing,
      }),
    ).toBe(true);
  });

  it('shows the link when the wallet payment is ready', () => {
    expect(
      shouldShowPrimeInfiniExternalCheckoutLink({
        canUseExternalCheckout: true,
        isOptionsRefreshing: false,
      }),
    ).toBe(true);
  });

  it('keeps the link hidden while payment options are refreshing', () => {
    expect(
      shouldShowPrimeInfiniExternalCheckoutLink({
        canUseExternalCheckout: true,
        isOptionsRefreshing: true,
      }),
    ).toBe(false);
  });

  it('keeps the link hidden when external checkout is unavailable', () => {
    expect(
      shouldShowPrimeInfiniExternalCheckoutLink({
        canUseExternalCheckout: false,
        isOptionsRefreshing: false,
      }),
    ).toBe(false);
  });
});
