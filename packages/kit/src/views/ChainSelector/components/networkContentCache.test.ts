import { buildNetworkContentSwrKey } from './networkContentCache';

describe('buildNetworkContentSwrKey', () => {
  it('keeps one slot per HD wallet account across its per-network account ids', () => {
    const evm = buildNetworkContentSwrKey({
      walletId: 'hd-1',
      accountId: "hd-1--m/44'/60'/0'/0/0",
      indexedAccountId: 'hd-1--0',
      networkIdsKey: undefined,
    });
    const sol = buildNetworkContentSwrKey({
      walletId: 'hd-1',
      accountId: "hd-1--m/44'/501'/0'/0'",
      indexedAccountId: 'hd-1--0',
      networkIdsKey: undefined,
    });
    const noAccountYet = buildNetworkContentSwrKey({
      walletId: 'hd-1',
      accountId: undefined,
      indexedAccountId: 'hd-1--0',
      networkIdsKey: undefined,
    });
    expect(evm).toBe(sol);
    expect(evm).toBe(noAccountYet);
  });

  it('separates indexed accounts, wallets and network id sets', () => {
    const base = {
      walletId: 'hd-1',
      accountId: "hd-1--m/44'/60'/0'/0/0",
      indexedAccountId: 'hd-1--0',
      networkIdsKey: undefined,
    };
    const key = buildNetworkContentSwrKey(base);
    expect(key).not.toBe(
      buildNetworkContentSwrKey({ ...base, indexedAccountId: 'hd-1--1' }),
    );
    expect(key).not.toBe(
      buildNetworkContentSwrKey({ ...base, walletId: 'hw-1' }),
    );
    expect(key).not.toBe(
      buildNetworkContentSwrKey({ ...base, networkIdsKey: 'evm--1,sol--101' }),
    );
  });

  it('scopes others wallets by account because their network set is per account', () => {
    const a = buildNetworkContentSwrKey({
      walletId: 'imported',
      accountId: 'imported--60--0xaaa',
      indexedAccountId: undefined,
      networkIdsKey: undefined,
    });
    const b = buildNetworkContentSwrKey({
      walletId: 'imported',
      accountId: 'imported--501--bbb',
      indexedAccountId: undefined,
      networkIdsKey: undefined,
    });
    expect(a).not.toBe(b);
  });
});
