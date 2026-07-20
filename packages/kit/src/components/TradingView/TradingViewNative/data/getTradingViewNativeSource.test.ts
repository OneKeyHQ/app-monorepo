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
});
