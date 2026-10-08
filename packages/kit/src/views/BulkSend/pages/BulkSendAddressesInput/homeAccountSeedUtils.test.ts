import { buildBulkSendHomeAccountSeedKey } from './homeAccountSeedUtils';

/*
yarn jest packages/kit/src/views/BulkSend/pages/BulkSendAddressesInput/homeAccountSeedUtils.test.ts
*/

describe('buildBulkSendHomeAccountSeedKey', () => {
  it('ignores a derive-type-only change of the same indexed account (OK-61627)', () => {
    const taproot = buildBulkSendHomeAccountSeedKey({
      networkId: 'btc--0',
      accountId: "hd-1--m/86'/0'/0'/0/1",
      indexedAccountId: 'hd-1--1',
    });
    const nested = buildBulkSendHomeAccountSeedKey({
      networkId: 'btc--0',
      accountId: "hd-1--m/49'/0'/0'/0/1",
      indexedAccountId: 'hd-1--1',
    });
    expect(nested).toBe(taproot);
  });

  it('changes when the indexed account, wallet or network changes', () => {
    const base = buildBulkSendHomeAccountSeedKey({
      networkId: 'btc--0',
      accountId: "hd-1--m/86'/0'/0'/0/1",
      indexedAccountId: 'hd-1--1',
    });
    expect(
      buildBulkSendHomeAccountSeedKey({
        networkId: 'btc--0',
        accountId: "hd-1--m/86'/0'/0'/0/0",
        indexedAccountId: 'hd-1--0',
      }),
    ).not.toBe(base);
    expect(
      buildBulkSendHomeAccountSeedKey({
        networkId: 'btc--0',
        accountId: "hd-2--m/86'/0'/0'/0/1",
        indexedAccountId: 'hd-2--1',
      }),
    ).not.toBe(base);
    expect(
      buildBulkSendHomeAccountSeedKey({
        networkId: 'evm--1',
        accountId: "hd-1--m/44'/60'/0'/0/1",
        indexedAccountId: 'hd-1--1',
      }),
    ).not.toBe(base);
  });

  it('keeps the key stable while the home account has no address for the new derive type', () => {
    const withAccount = buildBulkSendHomeAccountSeedKey({
      networkId: 'btc--0',
      accountId: "hd-1--m/86'/0'/0'/0/1",
      indexedAccountId: 'hd-1--1',
    });
    const withoutAccount = buildBulkSendHomeAccountSeedKey({
      networkId: 'btc--0',
      accountId: undefined,
      indexedAccountId: 'hd-1--1',
    });
    expect(withoutAccount).toBe(withAccount);
  });

  it('falls back to the account id for wallets without indexed accounts', () => {
    const imported = buildBulkSendHomeAccountSeedKey({
      networkId: 'btc--0',
      accountId: 'imported--0--abc',
      indexedAccountId: undefined,
    });
    const otherImported = buildBulkSendHomeAccountSeedKey({
      networkId: 'btc--0',
      accountId: 'imported--0--def',
      indexedAccountId: undefined,
    });
    expect(imported).not.toBe(otherImported);
    expect(
      buildBulkSendHomeAccountSeedKey({
        networkId: undefined,
        accountId: undefined,
        indexedAccountId: undefined,
      }),
    ).toBe(
      buildBulkSendHomeAccountSeedKey({
        networkId: undefined,
        accountId: undefined,
        indexedAccountId: undefined,
      }),
    );
  });
});
