import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { getHomeTokenListRowKeys } from './utils';

const token = (
  $key: string,
  props: Partial<IAccountToken> = {},
): IAccountToken => ({
  $key,
  name: 'BNB',
  symbol: 'BNB',
  address: '',
  decimals: 18,
  isNative: true,
  networkId: 'evm--56',
  ...props,
});

describe('getHomeTokenListRowKeys', () => {
  it('gives the same asset the same row key across owner-scoped data keys', () => {
    const a = token('evm--56_accountA_');
    const b = token('evm--56_accountB_');
    expect(getHomeTokenListRowKeys([a]).get(a.$key)).toBe(
      getHomeTokenListRowKeys([b]).get(b.$key),
    );
    expect(a.$key).not.toBe(b.$key);
  });

  it('keeps different networks and contracts distinct', () => {
    const tokens = [
      token('a'),
      token('b', { networkId: 'evm--1' }),
      token('c', { address: 'contract' }),
    ];
    expect(new Set(getHomeTokenListRowKeys(tokens).values()).size).toBe(3);
  });

  it('keeps duplicate-asset rows (merge-derive) and aggregate rows distinct', () => {
    const tokens = [
      token('deriveA'),
      token('deriveB'),
      token('aggregate_BNB', { isAggregateToken: true }),
      token('aggregate_ETH', { isAggregateToken: true }),
    ];
    const keys = getHomeTokenListRowKeys(tokens);
    expect(new Set(keys.values()).size).toBe(4);
    expect(keys.get('deriveA')).toBe('owner:deriveA');
    expect(keys.get('deriveB')).toBe('owner:deriveB');
    expect(keys.get('aggregate_BNB')).toBe('aggregate:aggregate_BNB');
  });

  it('falls back to the data key when the network is unknown', () => {
    const tokens = [
      token('a', { networkId: undefined }),
      token('b', { networkId: undefined }),
    ];
    expect(new Set(getHomeTokenListRowKeys(tokens).values()).size).toBe(2);
  });
});
