import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { filterTokensByAccountNetworkCompatibility } from './tokenSelectorAccountCompatibility';

function buildTestToken(params: Partial<IAccountToken>): IAccountToken {
  return {
    $key: params.$key ?? 'token',
    address: params.address ?? '0x0',
    decimals: params.decimals ?? 6,
    isNative: params.isNative ?? false,
    name: params.name ?? 'USD Coin',
    symbol: params.symbol ?? 'USDC',
    ...params,
  };
}

describe('filterTokensByAccountNetworkCompatibility', () => {
  const tokens = [
    buildTestToken({ $key: 'a', networkId: 'evm--1' }),
    buildTestToken({ $key: 'b', networkId: 'evm--8453' }),
    buildTestToken({ $key: 'c', networkId: 'sol--101' }),
    buildTestToken({ $key: 'd', networkId: 'tron--0x2b6653dc' }),
  ];

  test('imported EVM account keeps every EVM network and drops the rest', () => {
    const account = { id: 'imported--60--0xabc', impl: 'evm' } as IDBAccount;
    expect(
      filterTokensByAccountNetworkCompatibility({ tokens, account }).map(
        (t) => t.$key,
      ),
    ).toEqual(['a', 'b']);
  });

  test('watch-only account restricted to one network keeps only that network', () => {
    const account = {
      id: 'watching--60--0xabc',
      impl: 'evm',
      networks: ['evm--1'],
    } as IDBAccount;
    expect(
      filterTokensByAccountNetworkCompatibility({ tokens, account }).map(
        (t) => t.$key,
      ),
    ).toEqual(['a']);
  });

  test('non-EVM imported account drops incompatible impls', () => {
    const account = { id: 'imported--501--xyz', impl: 'sol' } as IDBAccount;
    expect(
      filterTokensByAccountNetworkCompatibility({ tokens, account }).map(
        (t) => t.$key,
      ),
    ).toEqual(['c']);
  });

  test('rows without a networkId are never dropped (defensive)', () => {
    const account = { id: 'imported--501--xyz', impl: 'sol' } as IDBAccount;
    const withBlank = [...tokens, buildTestToken({ $key: 'e' })];
    expect(
      filterTokensByAccountNetworkCompatibility({
        tokens: withBlank,
        account,
      }).map((t) => t.$key),
    ).toEqual(['c', 'e']);
  });
});
