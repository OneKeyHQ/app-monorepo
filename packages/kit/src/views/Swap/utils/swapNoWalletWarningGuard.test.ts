import {
  removeSwapNoConnectWalletAlerts,
  shouldAllowSwapNoConnectWalletWarning,
} from './swapNoWalletWarningGuard';

describe('shouldAllowSwapNoConnectWalletWarning', () => {
  it('blocks the warning before account info is ready', () => {
    expect(
      shouldAllowSwapNoConnectWalletWarning({
        accountInfoReady: false,
        accountSelectorActiveAccountInitDone: true,
        accountSelectorStorageInitDone: true,
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
        hasAccountWallet: false,
        isWebDappMode: true,
        walletListResolvedNoWallet: false,
      }),
    ).toBe(true);
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
