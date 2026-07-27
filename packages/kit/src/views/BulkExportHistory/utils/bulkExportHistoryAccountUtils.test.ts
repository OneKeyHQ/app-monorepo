import {
  buildBulkExportHistoryAccountIdentifierMap,
  getBulkExportHistoryAccountIdentifiers,
  getBulkExportHistoryAccountNetworkCompatibility,
  getBulkExportHistoryAccountTypeForTracking,
  resolveBulkExportHistoryAccountIdentity,
} from './bulkExportHistoryAccountUtils';

describe('bulkExportHistoryAccountUtils', () => {
  it('supports indexed accounts', () => {
    expect(
      resolveBulkExportHistoryAccountIdentity({
        accountId: "hd-1--m/44'/60'/0'/0/0",
        indexedAccountId: 'hd-1--0',
      }),
    ).toEqual({
      type: 'indexed',
      indexedAccountId: 'hd-1--0',
    });
  });

  it.each([
    'watching--60--0x1234',
    'watching--0--xpub1234',
    'imported--60--public-key',
  ])('supports singleton account %s', (accountId) => {
    expect(
      resolveBulkExportHistoryAccountIdentity({
        accountId,
        indexedAccountId: undefined,
      }),
    ).toEqual({
      type: 'singleton',
      accountId,
    });
  });

  it.each([
    undefined,
    'external--60--injected--example',
    'watching--global-url-account',
  ])('does not support account %s', (accountId) => {
    expect(
      resolveBulkExportHistoryAccountIdentity({
        accountId,
        indexedAccountId: undefined,
      }),
    ).toBeUndefined();
  });

  it.each([
    [{ accountAddress: '0x1234', xpub: undefined }, ['0x1234']],
    [
      { accountAddress: 'bc1-address', xpub: 'wpkh(xpub1234)' },
      ['bc1-address', 'wpkh(xpub1234)'],
    ],
    [{ accountAddress: 'same-value', xpub: 'same-value' }, ['same-value']],
    [undefined, []],
  ])('resolves public account identifiers from %o', (accountMeta, expected) => {
    expect(getBulkExportHistoryAccountIdentifiers(accountMeta)).toEqual(
      expected,
    );
  });

  it('builds network-scoped public identifiers and reports missing networks', () => {
    expect(
      buildBulkExportHistoryAccountIdentifierMap({
        networkIds: ['evm--1', 'btc--0', 'sol--101'],
        accountMetaMap: {
          'evm--1': {
            accountAddress: '0x1234',
            xpub: undefined,
          },
          'btc--0': {
            accountAddress: 'bc1-address',
            xpub: 'wpkh(xpub1234)',
          },
        },
      }),
    ).toEqual({
      networkIdToAddressArray: {
        'evm--1': ['0x1234'],
        'btc--0': ['bc1-address', 'wpkh(xpub1234)'],
        'sol--101': [],
      },
      missingNetworkIds: ['sol--101'],
    });
  });

  it('uses the singleton account id for network compatibility', () => {
    expect(
      getBulkExportHistoryAccountNetworkCompatibility({
        accountIdentity: {
          type: 'singleton',
          accountId: 'watching--60--0x1234',
        },
        indexedAccountWalletId: undefined,
      }),
    ).toEqual({ accountId: 'watching--60--0x1234' });
  });

  it('uses the indexed account wallet id for network compatibility', () => {
    expect(
      getBulkExportHistoryAccountNetworkCompatibility({
        accountIdentity: {
          type: 'indexed',
          indexedAccountId: 'hd-1--0',
        },
        indexedAccountWalletId: 'hd-1',
      }),
    ).toEqual({ walletId: 'hd-1' });
  });

  it.each([
    [{ type: 'indexed' as const, indexedAccountId: 'hd-1--0' }, 'indexed'],
    [
      { type: 'singleton' as const, accountId: 'watching--60--0x1234' },
      'watching',
    ],
    [
      { type: 'singleton' as const, accountId: 'imported--60--public-key' },
      'imported',
    ],
  ])('maps account identity %o to tracking type %s', (identity, expected) => {
    expect(getBulkExportHistoryAccountTypeForTracking(identity)).toBe(expected);
  });
});
