import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { buildHomeTokenListCacheIngestRound } from './buildHomeTokenListCacheIngestRound';

function makeToken(
  key: string,
  overrides: Partial<IAccountToken> = {},
): IAccountToken {
  return {
    $key: key,
    name: key,
    symbol: key,
    decimals: 18,
    address: `0x${key}`,
    isNative: false,
    ...overrides,
  } as IAccountToken;
}

function makeFiat(
  fiatValue: string,
  overrides: Partial<ITokenFiat> = {},
): ITokenFiat {
  return {
    balance: '1',
    balanceParsed: '1',
    fiatValue,
    price: 1,
    ...overrides,
  };
}

describe('buildHomeTokenListCacheIngestRound', () => {
  it('builds a single-network cache ingest payload with visible and risky maps split', () => {
    const token = makeToken('native');
    const small = makeToken('dust');
    const risky = makeToken('risk');

    const payload = buildHomeTokenListCacheIngestRound({
      ownerKey: 'acc__evm--1',
      accountId: 'acc',
      networkId: 'evm--1',
      tokenList: [token],
      smallBalanceTokenList: [small],
      riskyTokenList: [risky],
      tokenListMap: {
        native: makeFiat('10'),
      },
      smallBalanceTokenListMap: {
        dust: makeFiat('0.25'),
      },
      riskyTokenListMap: {
        risk: makeFiat('999'),
      },
      source: 'singleCacheSeed',
    });

    expect(payload.ownerKey).toBe('acc__evm--1');
    expect(payload.orderedTokens).toEqual([token]);
    expect(payload.smallBalanceTokens).toEqual([small]);
    expect(payload.riskyTokens).toEqual([risky]);
    expect(payload.tokenListMap).toEqual({
      native: makeFiat('10'),
      dust: makeFiat('0.25'),
    });
    expect(payload.riskyMap).toEqual({
      risk: makeFiat('999'),
    });
    expect(payload.smallBalanceFiatValue).toBe('0.25');
    expect(payload.rawKeys).toBe('native_dust_risk');
    expect(payload.source).toBe('singleCacheSeed');
  });

  it('builds an empty owner-stamp payload for cached empty lists', () => {
    const payload = buildHomeTokenListCacheIngestRound({
      ownerKey: 'acc__btc--0',
      accountId: 'acc',
      networkId: 'btc--0',
      tokenList: [],
      smallBalanceTokenList: [],
      riskyTokenList: [],
      tokenListMap: {},
      source: 'singleEmptyCacheSeed',
    });

    expect(payload.ownerKey).toBe('acc__btc--0');
    expect(payload.orderedTokens).toEqual([]);
    expect(payload.smallBalanceTokens).toEqual([]);
    expect(payload.riskyTokens).toEqual([]);
    expect(payload.tokenListMap).toEqual({});
    expect(payload.riskyMap).toEqual({});
    expect(payload.smallBalanceFiatValue).toBe('0');
    expect(payload.rawKeys).toBe('__');
    expect(payload.source).toBe('singleEmptyCacheSeed');
  });

  it('preserves live response scalar and raw keys for a single-network round', () => {
    const small = makeToken('dust');
    const payload = buildHomeTokenListCacheIngestRound({
      ownerKey: 'acc__tron--0x2b6653dc',
      accountId: 'acc',
      networkId: 'tron--0x2b6653dc',
      tokenList: [],
      smallBalanceTokenList: [small],
      riskyTokenList: [],
      tokenListMap: {},
      smallBalanceTokenListMap: {
        dust: makeFiat('0.25'),
      },
      smallBalanceFiatValue: '0.30',
      rawKeys: 'server-owned-raw-keys',
      source: 'single',
    });

    expect(payload.smallBalanceFiatValue).toBe('0.30');
    expect(payload.rawKeys).toBe('server-owned-raw-keys');
    expect(payload.source).toBe('single');
  });
});
