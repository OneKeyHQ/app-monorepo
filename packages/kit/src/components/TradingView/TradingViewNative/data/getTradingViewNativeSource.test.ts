import {
  getTradingViewNativeSource,
  getTradingViewNativeSourceKey,
} from './getTradingViewNativeSource';

describe('TradingViewNative source resolver', () => {
  it('prefers a normalized Hyperliquid coin', () => {
    expect(
      getTradingViewNativeSource({
        hyperliquidCoin: ' BTC ',
        marketDataSource: 'websocket',
        networkId: 'btc--0',
        symbol: 'BTC',
        tokenAddress: '',
      }),
    ).toEqual({
      kind: 'hyperliquid',
      coin: 'BTC',
      environment: 'mainnet',
    });
  });

  it('keeps the Market transport in the Market source variant', () => {
    const source = getTradingViewNativeSource({
      hyperliquidCoin: '',
      marketDataSource: 'websocket',
      marketHistory: {
        provider: 'market',
        fallback: {
          provider: 'coinGecko',
          coinGeckoId: 'token',
        },
      },
      networkId: 'evm--1',
      symbol: 'TOKEN',
      tokenAddress: '0xAbC',
    });

    expect(source).toEqual({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '0xAbC',
      symbol: 'TOKEN',
      realtime: 'websocket',
      history: {
        provider: 'market',
        fallback: {
          provider: 'coinGecko',
          coinGeckoId: 'token',
        },
      },
    });
    expect(getTradingViewNativeSourceKey(source)).toBe(
      'market:evm--1:0xabc:TOKEN',
    );
  });

  it('includes a CoinGecko-only history identity in the source key', () => {
    const source = getTradingViewNativeSource({
      hyperliquidCoin: '',
      marketDataSource: 'polling',
      marketHistory: {
        provider: 'coinGecko',
        coinGeckoId: ' Ethereum ',
      },
      networkId: 'evm--1',
      symbol: 'eth',
      tokenAddress: '0xAbC',
    });

    expect(getTradingViewNativeSourceKey(source)).toBe(
      'market:evm--1:0xabc:ETH:history:coinGecko:ethereum',
    );
  });
});
