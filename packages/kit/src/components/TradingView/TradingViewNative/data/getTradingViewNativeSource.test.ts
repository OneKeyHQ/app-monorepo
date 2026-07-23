import {
  getTradingViewNativeMarketTokenKey,
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
    });
    expect(getTradingViewNativeSourceKey(source)).toBe(
      'market:evm--1:0xabc:TOKEN',
    );
  });

  it('normalizes the Market token identity independently from its symbol', () => {
    expect(
      getTradingViewNativeMarketTokenKey({
        networkId: ' evm--1 ',
        tokenAddress: '0xAbC',
      }),
    ).toBe('market:evm--1:0xabc');

    const source = getTradingViewNativeSource({
      hyperliquidCoin: '',
      marketDataSource: 'polling',
      networkId: 'evm--1',
      symbol: 'eth',
      tokenAddress: '0xAbC',
    });

    expect(getTradingViewNativeSourceKey(source)).toBe(
      'market:evm--1:0xabc:ETH',
    );
  });

  it('keeps a CoinGecko fallback hint inside the Market source', () => {
    const source = getTradingViewNativeSource({
      fallbackCoinGeckoId: ' bitcoin ',
      hyperliquidCoin: '',
      marketDataSource: 'polling',
      networkId: 'btc--0',
      symbol: 'BTC',
      tokenAddress: '',
    });

    expect(source).toEqual({
      kind: 'market',
      fallbackCoinGeckoId: 'bitcoin',
      networkId: 'btc--0',
      tokenAddress: '',
      symbol: 'BTC',
      realtime: 'disabled',
    });
    expect(getTradingViewNativeSourceKey(source)).toBe(
      'market:btc--0::BTC:coingecko:bitcoin',
    );
  });
});
