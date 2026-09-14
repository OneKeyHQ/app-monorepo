import { buildBulkCopyByAccountsFlowParams } from './buildBulkCopyByAccountsParams';

import type { IBulkCopyNetworkAccountsItem } from './buildBulkCopyByAccountsParams';

const btc = 'btc--0';

function accountEntry(deriveType: string, pathIndex: number | undefined) {
  return {
    deriveType,
    account: pathIndex === undefined ? undefined : { pathIndex },
  };
}

describe('buildBulkCopyByAccountsFlowParams', () => {
  it('scopes each derive type to its own account indexes (OK bulk copy 7/40 bug)', () => {
    // Repro: 10 taproot accounts (indexes 0..9), 1 account each for
    // nested/native segwit and legacy (index 0) -> 13 addresses total,
    // NOT 4 derive types x 10 indexes = 40.
    const networkAccounts: IBulkCopyNetworkAccountsItem[] = [
      {
        network: { id: btc },
        networkAccounts: [
          accountEntry('BIP86', 0),
          accountEntry('default', 0),
          accountEntry('BIP84', 0),
          accountEntry('BIP44', 0),
        ],
      },
      ...Array.from({ length: 9 }, (_, i) => ({
        network: { id: btc },
        networkAccounts: [accountEntry('BIP86', i + 1)],
      })),
    ];

    const { customNetworks, indexes, addressCount } =
      buildBulkCopyByAccountsFlowParams({ networkAccounts });

    expect(addressCount).toBe(13);
    expect(customNetworks).toHaveLength(4);
    expect(
      customNetworks.find((i) => i.deriveType === 'BIP86')?.indexes,
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(
      customNetworks.find((i) => i.deriveType === 'default')?.indexes,
    ).toEqual([0]);
    expect(
      customNetworks.find((i) => i.deriveType === 'BIP44')?.indexes,
    ).toEqual([0]);
    expect(indexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('skips accounts without pathIndex and dedupes repeated indexes', () => {
    const networkAccounts: IBulkCopyNetworkAccountsItem[] = [
      {
        network: { id: btc },
        networkAccounts: [
          accountEntry('BIP86', 3),
          accountEntry('BIP86', 3),
          accountEntry('BIP84', undefined),
        ],
      },
    ];

    const { customNetworks, indexes, addressCount } =
      buildBulkCopyByAccountsFlowParams({ networkAccounts });

    expect(addressCount).toBe(1);
    expect(customNetworks).toEqual([
      { networkId: btc, deriveType: 'BIP86', indexes: [3] },
    ]);
    expect(indexes).toEqual([3]);
  });

  it('keeps pairs distinct across networks', () => {
    const networkAccounts: IBulkCopyNetworkAccountsItem[] = [
      {
        network: { id: btc },
        networkAccounts: [accountEntry('BIP86', 0)],
      },
      {
        network: { id: 'tbtc--0' },
        networkAccounts: [accountEntry('BIP86', 0), accountEntry('BIP86', 1)],
      },
    ];

    const { customNetworks, addressCount } = buildBulkCopyByAccountsFlowParams({
      networkAccounts,
    });

    expect(addressCount).toBe(3);
    expect(customNetworks).toHaveLength(2);
  });

  it('returns empty params when nothing exists', () => {
    const { customNetworks, indexes, addressCount } =
      buildBulkCopyByAccountsFlowParams({ networkAccounts: [] });
    expect(customNetworks).toEqual([]);
    expect(indexes).toEqual([]);
    expect(addressCount).toBe(0);
  });
});
