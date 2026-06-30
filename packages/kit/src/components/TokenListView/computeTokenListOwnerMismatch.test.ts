import { computeTokenListOwnerMismatch } from './computeTokenListOwnerMismatch';

describe('computeTokenListOwnerMismatch', () => {
  it('EVM single-derive in steady state: settled === scoped → NO mismatch', () => {
    const owner = "hd-1--m/44'/60'/0'/0/0";
    expect(
      computeTokenListOwnerMismatch({
        accountId: owner,
        networkId: 'evm--1',
        indexedAccountId: 'hd-1--0',
        mergeDeriveAddressData: false,
        settledOwnerKey: `${owner}__evm--1`,
      }),
    ).toBe(false);
  });

  it('BTC merge-derive steady state: settled is stamped with indexedAccountId, scoped accountId is the derive path → NO mismatch (regression for the permanent-skeleton bug)', () => {
    // The exact shape from app-latest.log:
    //   ui.applyStruct OK owner=hd-1--0__btc--0     (settled = indexedAccountId form)
    //   allnet.trigger ... owner=hd-1--m/86'/0'/0'__btc--0  (scoped accountId form)
    // Before the fix this returned TRUE → ownerMismatch latched → skeleton forever.
    expect(
      computeTokenListOwnerMismatch({
        accountId: "hd-1--m/86'/0'/0'",
        networkId: 'btc--0',
        indexedAccountId: 'hd-1--0',
        mergeDeriveAddressData: true,
        settledOwnerKey: 'hd-1--0__btc--0',
      }),
    ).toBe(false);
  });

  it('real account switch (settled still on the previous owner) → mismatch, skeleton', () => {
    expect(
      computeTokenListOwnerMismatch({
        accountId: "hd-1--m/86'/0'/1'",
        networkId: 'btc--0',
        indexedAccountId: 'hd-1--1',
        mergeDeriveAddressData: true,
        // previous owner still settled
        settledOwnerKey: 'hd-1--0__btc--0',
      }),
    ).toBe(true);
  });

  it('network switch (same account, different network) → mismatch', () => {
    const owner = "hd-1--m/44'/60'/0'/0/0";
    expect(
      computeTokenListOwnerMismatch({
        accountId: owner,
        networkId: 'evm--56',
        indexedAccountId: 'hd-1--0',
        mergeDeriveAddressData: false,
        settledOwnerKey: `${owner}__evm--1`,
      }),
    ).toBe(true);
  });

  it('no settled owner key (non-home store / first frame not applied) → NO mismatch', () => {
    expect(
      computeTokenListOwnerMismatch({
        accountId: 'hd-1--whatever',
        networkId: 'evm--1',
        indexedAccountId: undefined,
        mergeDeriveAddressData: false,
        settledOwnerKey: '',
      }),
    ).toBe(false);
  });

  it('scoped owner not resolvable yet (no accountId) → NO mismatch', () => {
    expect(
      computeTokenListOwnerMismatch({
        accountId: undefined,
        networkId: 'evm--1',
        indexedAccountId: undefined,
        mergeDeriveAddressData: false,
        settledOwnerKey: 'hd-1--0__evm--1',
      }),
    ).toBe(false);
  });
});
