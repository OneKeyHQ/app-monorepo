import {
  hasSelectedAccountIdentity,
  isDefaultSelectedAccountForColdStart,
  shouldKeepCurrentActiveAccountForIncompleteSelection,
} from './activeAccountInitGuard';

describe('isDefaultSelectedAccountForColdStart', () => {
  it('treats an all-undefined selected account as default', () => {
    expect(
      isDefaultSelectedAccountForColdStart({
        walletId: undefined,
        indexedAccountId: undefined,
        othersWalletAccountId: undefined,
        networkId: undefined,
        deriveType: undefined,
        focusedWallet: undefined,
      }),
    ).toBe(true);
  });

  it('treats a selected wallet as non-default', () => {
    expect(
      isDefaultSelectedAccountForColdStart({
        walletId: 'hd-1',
        networkId: undefined,
      }),
    ).toBe(false);
  });
});

describe('hasSelectedAccountIdentity', () => {
  it('treats a network-only selected account as having no wallet identity', () => {
    expect(
      hasSelectedAccountIdentity({
        networkId: 'evm--1',
      }),
    ).toBe(false);
  });

  it('treats selected account wallet fields as identity', () => {
    expect(
      hasSelectedAccountIdentity({
        networkId: 'evm--1',
        indexedAccountId: 'indexed-1',
      }),
    ).toBe(true);
  });
});

describe('shouldKeepCurrentActiveAccountForIncompleteSelection', () => {
  it('keeps cached active account when storage init is pending and selected account is default', () => {
    expect(
      shouldKeepCurrentActiveAccountForIncompleteSelection({
        storageInitDone: false,
        selectedAccount: {
          walletId: undefined,
          indexedAccountId: undefined,
          othersWalletAccountId: undefined,
          networkId: undefined,
          deriveType: undefined,
          focusedWallet: undefined,
        },
        activeAccount: {
          wallet: { id: 'hd-1' },
        },
      }),
    ).toBe(true);
  });

  it('keeps current active account when selected account only carries a network', () => {
    expect(
      shouldKeepCurrentActiveAccountForIncompleteSelection({
        storageInitDone: true,
        selectedAccount: {
          networkId: 'evm--1',
        },
        activeAccount: {
          wallet: { id: 'hd-1' },
          account: { id: 'account-1' },
        },
      }),
    ).toBe(true);
  });

  it('allows default active account after storage init completes', () => {
    expect(
      shouldKeepCurrentActiveAccountForIncompleteSelection({
        storageInitDone: true,
        selectedAccount: {},
        activeAccount: {
          wallet: { id: 'hd-1' },
        },
      }),
    ).toBe(false);
  });

  it('does not keep an empty active account', () => {
    expect(
      shouldKeepCurrentActiveAccountForIncompleteSelection({
        storageInitDone: false,
        selectedAccount: {},
        activeAccount: {},
      }),
    ).toBe(false);
  });
});
