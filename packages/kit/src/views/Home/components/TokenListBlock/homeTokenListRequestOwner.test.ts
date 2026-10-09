import { isHomeTokenListRequestOwnerCurrent } from './homeTokenListRequestOwner';

const owner = {
  epoch: 1,
  accountId: 'all-account-a',
  indexedAccountId: 'indexed-a',
  walletId: 'wallet-a',
  networkId: 'onekeyall--0',
};
const activeAccount = {
  account: { id: owner.accountId },
  indexedAccount: { id: owner.indexedAccountId },
  wallet: { id: owner.walletId },
  network: { id: owner.networkId },
};
const selectedAccount = {
  walletId: owner.walletId,
  indexedAccountId: owner.indexedAccountId,
  networkId: owner.networkId,
  othersWalletAccountId: undefined,
};
const current = { owner, currentEpoch: 1, activeAccount, selectedAccount };

describe('isHomeTokenListRequestOwnerCurrent', () => {
  it('accepts the current fully resolved owner', () => {
    expect(isHomeTokenListRequestOwnerCurrent(current)).toBe(true);
  });

  it('rejects the old active account after a render captures the new selection epoch', () => {
    expect(
      isHomeTokenListRequestOwnerCurrent({
        ...current,
        owner: { ...owner, epoch: 2 },
        currentEpoch: 2,
        selectedAccount: { ...selectedAccount, indexedAccountId: 'indexed-b' },
      }),
    ).toBe(false);
  });

  it('rejects the previous run after A to B to A even when both identities match again', () => {
    expect(
      isHomeTokenListRequestOwnerCurrent({ ...current, currentEpoch: 3 }),
    ).toBe(false);
    expect(
      isHomeTokenListRequestOwnerCurrent({
        ...current,
        owner: { ...owner, epoch: 3 },
        currentEpoch: 3,
      }),
    ).toBe(true);
  });

  it.each([
    { walletId: 'wallet-b' },
    { networkId: 'evm--1' },
    { indexedAccountId: undefined },
  ])('rejects a pending selection change %p', (changed) => {
    expect(
      isHomeTokenListRequestOwnerCurrent({
        ...current,
        selectedAccount: { ...selectedAccount, ...changed },
      }),
    ).toBe(false);
  });

  it.each([
    { account: { id: 'different-account' } },
    { network: { id: 'evm--1' } },
    { wallet: { id: 'wallet-b' } },
    { indexedAccount: { id: 'indexed-b' } },
  ])('rejects a changed live active identity %p', (changed) => {
    expect(
      isHomeTokenListRequestOwnerCurrent({
        ...current,
        activeAccount: { ...activeAccount, ...changed },
      }),
    ).toBe(false);
  });

  it('preserves a cached active owner before selection hydration and for network-only selection', () => {
    for (const incompleteSelection of [
      undefined,
      {},
      { networkId: 'evm--1' },
    ]) {
      expect(
        isHomeTokenListRequestOwnerCurrent({
          ...current,
          selectedAccount: incompleteSelection,
        }),
      ).toBe(true);
    }
  });

  it('uses the selected account id for an Others wallet', () => {
    const others = {
      ...current,
      owner: { ...owner, indexedAccountId: undefined },
      activeAccount: { ...activeAccount, indexedAccount: undefined },
      selectedAccount: {
        ...selectedAccount,
        indexedAccountId: undefined,
        othersWalletAccountId: owner.accountId,
      },
    };
    expect(isHomeTokenListRequestOwnerCurrent(others)).toBe(true);
    expect(
      isHomeTokenListRequestOwnerCurrent({
        ...others,
        selectedAccount: {
          ...others.selectedAccount,
          othersWalletAccountId: 'different-account',
        },
      }),
    ).toBe(false);
  });
});
