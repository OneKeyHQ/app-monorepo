import {
  buildSwapLimitOrdersAccountIdKey,
  removeSwapNoConnectWalletAlerts,
  shouldAllowSwapNoConnectWalletWarning,
  shouldShowSwapAccountUnsupportedAlert,
  shouldShowSwapLimitOrders,
  shouldShowSwapLocalData,
} from './swapNoWalletWarningGuard';

describe('shouldAllowSwapNoConnectWalletWarning', () => {
  it('blocks the warning before account info is ready', () => {
    expect(
      shouldAllowSwapNoConnectWalletWarning({
        accountInfoReady: false,
        accountSelectorActiveAccountInitDone: true,
        accountSelectorStorageInitDone: true,
        hasAccount: false,
        hasAccountWallet: false,
        isWebDappMode: false,
        walletListResolvedNoWallet: true,
      }),
    ).toBe(false);
  });

  it('blocks the warning when a wallet exists', () => {
    expect(
      shouldAllowSwapNoConnectWalletWarning({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: true,
        accountSelectorStorageInitDone: true,
        hasAccount: true,
        hasAccountWallet: true,
        isWebDappMode: false,
        walletListResolvedNoWallet: true,
      }),
    ).toBe(false);
  });

  it('blocks the warning during native cold-start init even when account info has no wallet', () => {
    expect(
      shouldAllowSwapNoConnectWalletWarning({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: false,
        accountSelectorStorageInitDone: true,
        hasAccount: false,
        hasAccountWallet: false,
        isWebDappMode: false,
        walletListResolvedNoWallet: false,
      }),
    ).toBe(false);
  });

  it('allows the warning for a native real no-wallet state after init and wallet-list proof', () => {
    expect(
      shouldAllowSwapNoConnectWalletWarning({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: true,
        accountSelectorStorageInitDone: true,
        hasAccount: false,
        hasAccountWallet: false,
        isWebDappMode: false,
        walletListResolvedNoWallet: true,
      }),
    ).toBe(true);
  });

  it('allows the warning in web dapp mode after account info is ready and no wallet is connected', () => {
    expect(
      shouldAllowSwapNoConnectWalletWarning({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: false,
        accountSelectorStorageInitDone: false,
        hasAccount: false,
        hasAccountWallet: false,
        isWebDappMode: true,
        walletListResolvedNoWallet: false,
      }),
    ).toBe(true);
  });

  it('allows the warning in web dapp mode when a stale wallet remains without an account', () => {
    expect(
      shouldAllowSwapNoConnectWalletWarning({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: false,
        accountSelectorStorageInitDone: false,
        hasAccount: false,
        hasAccountWallet: true,
        isWebDappMode: true,
        walletListResolvedNoWallet: false,
      }),
    ).toBe(true);
  });

  it('blocks the warning in web dapp mode when an account is connected', () => {
    expect(
      shouldAllowSwapNoConnectWalletWarning({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: false,
        accountSelectorStorageInitDone: false,
        hasAccount: true,
        hasAccountWallet: true,
        isWebDappMode: true,
        walletListResolvedNoWallet: false,
      }),
    ).toBe(false);
  });
});

describe('removeSwapNoConnectWalletAlerts', () => {
  it('removes only noConnectWallet alerts', () => {
    expect(
      removeSwapNoConnectWalletAlerts([
        { message: 'keep me' },
        { noConnectWallet: true },
      ]),
    ).toEqual([{ message: 'keep me' }]);
  });
});

describe('shouldShowSwapLocalData', () => {
  it('hides local data before account readiness is proven', () => {
    expect(
      shouldShowSwapLocalData({
        accountInfoReady: false,
        accountSelectorActiveAccountInitDone: true,
        accountSelectorStorageInitDone: true,
        hasAccount: true,
        hasDbAccount: false,
        hasAccountWallet: true,
        hasIndexedAccount: false,
      }),
    ).toBe(false);
  });

  it('hides local data before account selector init finishes', () => {
    expect(
      shouldShowSwapLocalData({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: false,
        accountSelectorStorageInitDone: true,
        hasAccount: true,
        hasDbAccount: false,
        hasAccountWallet: true,
        hasIndexedAccount: false,
      }),
    ).toBe(false);
  });

  it('hides local data after disconnect when stale wallet info has no account owner', () => {
    expect(
      shouldShowSwapLocalData({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: true,
        accountSelectorStorageInitDone: true,
        hasAccount: false,
        hasDbAccount: false,
        hasAccountWallet: true,
        hasIndexedAccount: false,
      }),
    ).toBe(false);
  });

  it('shows local data for a connected network account', () => {
    expect(
      shouldShowSwapLocalData({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: true,
        accountSelectorStorageInitDone: true,
        hasAccount: true,
        hasDbAccount: false,
        hasAccountWallet: true,
        hasIndexedAccount: false,
      }),
    ).toBe(true);
  });

  it('shows local data for a connected indexed account such as All Networks', () => {
    expect(
      shouldShowSwapLocalData({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: true,
        accountSelectorStorageInitDone: true,
        hasAccount: false,
        hasDbAccount: false,
        hasAccountWallet: true,
        hasIndexedAccount: true,
      }),
    ).toBe(true);
  });

  it('shows local data for a connected dbAccount such as external wallets', () => {
    expect(
      shouldShowSwapLocalData({
        accountInfoReady: true,
        accountSelectorActiveAccountInitDone: true,
        accountSelectorStorageInitDone: true,
        hasAccount: false,
        hasDbAccount: true,
        hasAccountWallet: true,
        hasIndexedAccount: false,
      }),
    ).toBe(true);
  });

  it('updates visibility across connect, disconnect, and reconnect transitions', () => {
    const baseReadyState = {
      accountInfoReady: true,
      accountSelectorActiveAccountInitDone: true,
      accountSelectorStorageInitDone: true,
    };

    expect(
      shouldShowSwapLocalData({
        ...baseReadyState,
        hasAccount: true,
        hasDbAccount: false,
        hasAccountWallet: true,
        hasIndexedAccount: false,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapLocalData({
        ...baseReadyState,
        hasAccount: false,
        hasDbAccount: false,
        hasAccountWallet: true,
        hasIndexedAccount: false,
      }),
    ).toBe(false);
    expect(
      shouldShowSwapLocalData({
        ...baseReadyState,
        hasAccount: true,
        hasDbAccount: false,
        hasAccountWallet: true,
        hasIndexedAccount: false,
      }),
    ).toBe(true);
  });
});

describe('buildSwapLimitOrdersAccountIdKey', () => {
  it('prefers indexed account identity', () => {
    expect(
      buildSwapLimitOrdersAccountIdKey({
        indexedAccountId: 'indexed-1',
        otherWalletTypeAccountId: 'account-1',
      }),
    ).toBe('indexed-1');
  });

  it('falls back to other wallet account identity', () => {
    expect(
      buildSwapLimitOrdersAccountIdKey({
        otherWalletTypeAccountId: 'account-1',
      }),
    ).toBe('account-1');
  });

  it('uses the service no-account key when no identity exists', () => {
    expect(buildSwapLimitOrdersAccountIdKey({})).toBe('noAccountId');
  });
});

describe('shouldShowSwapLimitOrders', () => {
  it('hides limit orders when local data is hidden', () => {
    expect(
      shouldShowSwapLimitOrders({
        shouldShowLocalData: false,
        currentAccountIdKey: 'indexed-1',
        limitOrdersAccountIdKey: 'indexed-1',
      }),
    ).toBe(false);
  });

  it('hides stale limit orders from another account', () => {
    expect(
      shouldShowSwapLimitOrders({
        shouldShowLocalData: true,
        currentAccountIdKey: 'indexed-2',
        limitOrdersAccountIdKey: 'indexed-1',
      }),
    ).toBe(false);
  });

  it('hides limit orders before the fetched account key is known', () => {
    expect(
      shouldShowSwapLimitOrders({
        shouldShowLocalData: true,
        currentAccountIdKey: 'indexed-1',
        limitOrdersAccountIdKey: undefined,
      }),
    ).toBe(false);
  });

  it('shows limit orders for the current fetched account key', () => {
    expect(
      shouldShowSwapLimitOrders({
        shouldShowLocalData: true,
        currentAccountIdKey: 'indexed-1',
        limitOrdersAccountIdKey: 'indexed-1',
      }),
    ).toBe(true);
  });

  it('updates limit-order visibility across disconnect and reconnect account keys', () => {
    const fetchedAccountKey = 'account-1';

    expect(
      shouldShowSwapLimitOrders({
        shouldShowLocalData: true,
        currentAccountIdKey: fetchedAccountKey,
        limitOrdersAccountIdKey: fetchedAccountKey,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapLimitOrders({
        shouldShowLocalData: false,
        currentAccountIdKey: 'noAccountId',
        limitOrdersAccountIdKey: fetchedAccountKey,
      }),
    ).toBe(false);
    expect(
      shouldShowSwapLimitOrders({
        shouldShowLocalData: true,
        currentAccountIdKey: 'account-2',
        limitOrdersAccountIdKey: fetchedAccountKey,
      }),
    ).toBe(false);
    expect(
      shouldShowSwapLimitOrders({
        shouldShowLocalData: true,
        currentAccountIdKey: fetchedAccountKey,
        limitOrdersAccountIdKey: fetchedAccountKey,
      }),
    ).toBe(true);
  });
});

describe('shouldShowSwapAccountUnsupportedAlert', () => {
  it('blocks the alert when no real account is connected', () => {
    expect(
      shouldShowSwapAccountUnsupportedAlert({
        hasFromToken: true,
        fromAddress: undefined,
        walletId: 'external',
        accountId: undefined,
      }),
    ).toBe(false);
  });

  it('allows the alert for a connected non-indexed wallet without a swap address', () => {
    expect(
      shouldShowSwapAccountUnsupportedAlert({
        hasFromToken: true,
        fromAddress: undefined,
        walletId: 'external',
        accountId: 'external--60--0xabc',
      }),
    ).toBe(true);
  });

  it('blocks the alert for HD wallets so address creation checks can handle them', () => {
    expect(
      shouldShowSwapAccountUnsupportedAlert({
        hasFromToken: true,
        fromAddress: undefined,
        walletId: 'hd-1',
        accountId: 'hd-1--m/44/60/0/0/0',
      }),
    ).toBe(false);
  });
});
