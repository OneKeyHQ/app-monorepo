import { getMarketDetailTradingViewNativeSource } from './getMarketDetailTradingViewNativeSource';

describe('Market detail TradingViewNative source', () => {
  it('prefers a configured Hyperliquid ticker', () => {
    expect(
      getMarketDetailTradingViewNativeSource({
        hyperliquidCoin: 'BTC',
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

  it('keeps Market transport selection inside the Market source variant', () => {
    expect(
      getMarketDetailTradingViewNativeSource({
        hyperliquidCoin: '',
        marketDataSource: 'websocket',
        networkId: 'evm--1',
        symbol: 'TOKEN',
        tokenAddress: '0xabc',
      }),
    ).toEqual({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'websocket',
    });
  });
});
