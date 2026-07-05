import {
  removeSwapNoConnectWalletAlerts,
  shouldAllowSwapNoConnectWalletWarning,
  shouldShowSwapAccountUnsupportedAlert,
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
