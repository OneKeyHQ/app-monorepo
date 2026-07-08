import {
  isWalletListResolvedNoWallet,
  shouldShowNoWalletContent,
} from './homePageNoWalletContent';

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

  it('allows the no-wallet empty state when the active wallet is already unusable but the wallet list cache is stale', () => {
    expect(
      shouldShowNoWalletContent({
        hasNoUsableWallet: true,
        accountSelectorStorageInitDone: true,
        accountSelectorActiveAccountInitDone: true,
        walletListResolvedNoWallet: false,
        activeWalletUnavailable: true,
        activeWalletId: 'hw-removed',
        walletListWalletIds: ['hw-removed'],
      }),
    ).toBe(true);
  });

  it('keeps blocking the no-wallet empty state for a usable single wallet without a matched account', () => {
    expect(
      shouldShowNoWalletContent({
        hasNoUsableWallet: true,
        accountSelectorStorageInitDone: true,
        accountSelectorActiveAccountInitDone: true,
        walletListResolvedNoWallet: false,
        activeWalletUnavailable: false,
        activeWalletId: '$$watching',
        walletListWalletIds: ['$$watching'],
      }),
    ).toBe(false);
  });

  it('keeps blocking the no-wallet empty state when another wallet remains in the list', () => {
    expect(
      shouldShowNoWalletContent({
        hasNoUsableWallet: true,
        accountSelectorStorageInitDone: true,
        accountSelectorActiveAccountInitDone: true,
        walletListResolvedNoWallet: false,
        activeWalletUnavailable: true,
        activeWalletId: 'hw-removed',
        walletListWalletIds: ['hw-removed', 'hw-usable'],
      }),
    ).toBe(false);
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

describe('isWalletListResolvedNoWallet', () => {
  it('waits for the wallet list to resolve', () => {
    expect(isWalletListResolvedNoWallet({ wallets: undefined })).toBe(false);
  });

  it('treats an empty wallet list as no wallet', () => {
    expect(isWalletListResolvedNoWallet({ wallets: [] })).toBe(true);
  });

  it('treats mocked and deprecated wallet records as no usable wallet', () => {
    expect(
      isWalletListResolvedNoWallet({
        wallets: [
          {
            isMocked: true,
          },
          {
            deprecated: true,
          },
        ],
      }),
    ).toBe(true);
  });

  it('keeps the wallet list non-empty when a real wallet remains', () => {
    expect(
      isWalletListResolvedNoWallet({
        wallets: [
          {
            isMocked: true,
          },
          {},
        ],
      }),
    ).toBe(false);
  });
});
