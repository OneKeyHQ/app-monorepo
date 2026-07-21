import type { IAccountToken } from '@onekeyhq/shared/types/token';

import {
  resolveHomeTokenProjectionBase,
  selectHomeTokensByStoreIds,
} from './homeStoreDisplayAuthority';

function token(key: string): IAccountToken {
  return {
    $key: key,
    address: key,
    decimals: 18,
    isNative: false,
    name: key,
    symbol: key.toUpperCase(),
  };
}

describe('Home Store token display authority', () => {
  it('uses local structure only before Store display authority exists', () => {
    expect(
      resolveHomeTokenProjectionBase({
        homeStoreDisplayIds: undefined,
        localOrderedIds: ['local-a'],
        localSmallBalanceIds: ['local-small'],
      }),
    ).toEqual({
      orderedIds: ['local-a'],
      smallBalanceIds: ['local-small'],
    });
  });

  it('treats an authoritative empty list as empty without local fallback', () => {
    expect(
      resolveHomeTokenProjectionBase({
        homeStoreDisplayIds: [],
        localOrderedIds: ['stale-local'],
        localSmallBalanceIds: ['stale-small'],
      }),
    ).toEqual({ orderedIds: [], smallBalanceIds: [] });
  });

  it('preserves Store order and excludes local-only ids', () => {
    expect(
      resolveHomeTokenProjectionBase({
        homeStoreDisplayIds: ['store-b', 'store-a', 'store-small'],
        localOrderedIds: ['store-a', 'local-only', 'store-b'],
        localSmallBalanceIds: ['local-small', 'store-small'],
      }),
    ).toEqual({
      orderedIds: ['store-b', 'store-a'],
      smallBalanceIds: ['store-small'],
    });
  });

  it('uses cells only to resolve entities for Store ids', () => {
    const a = token('a');
    const b = token('b');
    expect(
      selectHomeTokensByStoreIds({
        homeStoreDisplayIds: ['b', 'missing', 'a'],
        tokens: [a, b, token('local-only')],
      }),
    ).toEqual([b, a]);
  });
});
