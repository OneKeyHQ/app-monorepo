import { shouldShowNoWalletContent } from './homePageNoWalletContent';

describe('shouldShowNoWalletContent', () => {
  it('blocks the no-wallet empty state before account selector storage init completes', () => {
    expect(
      shouldShowNoWalletContent({
        hasNoUsableWallet: true,
        accountSelectorStorageInitDone: false,
        accountSelectorActiveAccountInitDone: false,
        walletListResolvedNoWallet: false,
      }),
    ).toBe(false);
  });

  it('blocks the no-wallet empty state before active account init completes', () => {
    expect(
      shouldShowNoWalletContent({
        hasNoUsableWallet: true,
        accountSelectorStorageInitDone: true,
        accountSelectorActiveAccountInitDone: false,
        walletListResolvedNoWallet: false,
      }),
    ).toBe(false);
  });

  it('blocks the no-wallet empty state before the wallet list resolves as empty', () => {
    expect(
      shouldShowNoWalletContent({
        hasNoUsableWallet: true,
        accountSelectorStorageInitDone: true,
        accountSelectorActiveAccountInitDone: true,
        walletListResolvedNoWallet: false,
      }),
    ).toBe(false);
  });

  it('allows the no-wallet empty state after init resolves for a real no-wallet user', () => {
    expect(
      shouldShowNoWalletContent({
        hasNoUsableWallet: true,
        accountSelectorStorageInitDone: true,
        accountSelectorActiveAccountInitDone: true,
        walletListResolvedNoWallet: true,
      }),
    ).toBe(true);
  });

  it('does not block cached usable wallet content while storage init is still running', () => {
    expect(
      shouldShowNoWalletContent({
        hasNoUsableWallet: false,
        accountSelectorStorageInitDone: false,
        accountSelectorActiveAccountInitDone: false,
        walletListResolvedNoWallet: false,
      }),
    ).toBe(false);
  });
});
