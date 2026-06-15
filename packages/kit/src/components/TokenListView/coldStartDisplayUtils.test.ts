import { sortTokensByFiatValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  getColdStartTokenListDisplayMaps,
  isRenderedTokenListCacheEntrySame,
} from './coldStartDisplayUtils';

function makeToken($key: string, symbol: string): IAccountToken {
  return {
    $key,
    address: '',
    decimals: 18,
    isNative: true,
    logoURI: '',
    name: symbol,
    symbol,
  } as IAccountToken;
}

function makeFiat(fiatValue: string, balanceParsed = '1'): ITokenFiat {
  return {
    price: Number(fiatValue),
    price24h: 0,
    balance: balanceParsed,
    balanceParsed,
    fiatValue,
    currency: 'usd',
  };
}

describe('getColdStartTokenListDisplayMaps', () => {
  it('uses cached token and aggregate maps for first-frame sorting and row values', () => {
    const btc = makeToken('btc--0_native', 'BTC');
    const eth = makeToken('aggregate_ETH_', 'ETH');

    const displayMaps = getColdStartTokenListDisplayMaps({
      shouldUseCachedMaps: true,
      cachedEntry: {
        tokens: [btc, eth],
        tokenListMap: {
          [btc.$key]: makeFiat('8', '0.0001265'),
        },
        aggregateTokensMap: {
          [eth.$key]: {
            'evm--1': makeFiat('11', '0.006786'),
          },
        },
        accountId: 'hd-1--0000/0',
        networkId: 'onekeyall--0',
      },
      currentTokenListMap: {},
      currentAggregateTokenMap: {},
    });

    expect(displayMaps.isUsingCachedMaps).toBe(true);
    expect(displayMaps.contextTokenListMap[btc.$key]?.balanceParsed).toBe(
      '0.0001265',
    );
    expect(displayMaps.contextTokenListMap[eth.$key]?.balanceParsed).toBe(
      '0.006786',
    );

    const sorted = sortTokensByFiatValue({
      tokens: [btc, eth],
      map: {
        ...displayMaps.tokenListMap,
        ...displayMaps.aggregateTokenMap,
      },
    });

    expect(sorted.map((token) => token.$key)).toEqual([eth.$key, btc.$key]);
  });

  it('keeps current maps when cached maps should not drive the rendered frame', () => {
    const liveTokenMap = {
      'btc--0_native': makeFiat('9'),
    };
    const liveAggregateMap = {
      aggregate_ETH_: makeFiat('12'),
    };

    const displayMaps = getColdStartTokenListDisplayMaps({
      shouldUseCachedMaps: false,
      cachedEntry: {
        tokens: [makeToken('btc--0_native', 'BTC')],
        tokenListMap: {
          'btc--0_native': makeFiat('8'),
        },
        accountId: 'hd-1--0000/0',
        networkId: 'onekeyall--0',
      },
      currentTokenListMap: liveTokenMap,
      currentAggregateTokenMap: liveAggregateMap,
    });

    expect(displayMaps.isUsingCachedMaps).toBe(false);
    expect(displayMaps.tokenListMap).toBe(liveTokenMap);
    expect(displayMaps.aggregateTokenMap).toBe(liveAggregateMap);
    expect(displayMaps.contextTokenListMap).toBe(liveTokenMap);
  });
});

describe('isRenderedTokenListCacheEntrySame', () => {
  it('treats a new token array with the same keys and map references as unchanged', () => {
    const tokenMap = {
      'btc--0_native': makeFiat('8'),
    };
    const aggregateTokensMap = {
      aggregate_ETH_: {
        'evm--1': makeFiat('11'),
      },
    };
    const btc = makeToken('btc--0_native', 'BTC');
    const eth = makeToken('aggregate_ETH_', 'ETH');

    expect(
      isRenderedTokenListCacheEntrySame(
        {
          tokens: [btc, eth],
          tokenListMap: tokenMap,
          aggregateTokensMap,
          accountId: 'hd-1--0000/0',
          networkId: 'onekeyall--0',
        },
        {
          tokens: [{ ...btc }, { ...eth }],
          tokenListMap: tokenMap,
          aggregateTokensMap,
          accountId: 'hd-1--0000/0',
          networkId: 'onekeyall--0',
        },
      ),
    ).toBe(true);
  });

  it('detects token order changes as cache changes', () => {
    const tokenMap = {
      'btc--0_native': makeFiat('8'),
    };
    const btc = makeToken('btc--0_native', 'BTC');
    const eth = makeToken('aggregate_ETH_', 'ETH');

    expect(
      isRenderedTokenListCacheEntrySame(
        {
          tokens: [btc, eth],
          tokenListMap: tokenMap,
          accountId: 'hd-1--0000/0',
          networkId: 'onekeyall--0',
        },
        {
          tokens: [eth, btc],
          tokenListMap: tokenMap,
          accountId: 'hd-1--0000/0',
          networkId: 'onekeyall--0',
        },
      ),
    ).toBe(false);
  });
});
