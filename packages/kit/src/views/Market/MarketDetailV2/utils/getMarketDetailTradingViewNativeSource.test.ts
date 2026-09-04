import { getMarketDetailTradingViewNativeSource } from './getMarketDetailTradingViewNativeSource';

describe('Market detail TradingViewNative source', () => {
  it('uses the Asset API identity for Top Coins', () => {
    expect(
      getMarketDetailTradingViewNativeSource({
        hyperliquidCoin: '',
        marketAssetId: 'doge',
        marketDataSource: 'polling',
        networkId: 'doge--0',
        symbol: 'DOGE',
        tokenAddress: '',
      }),
    ).toEqual({
      kind: 'asset',
      assetId: 'doge',
    });
  });

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

  it('uses the native Bitcoin whitelist before detail metadata loads', () => {
    expect(
      getMarketDetailTradingViewNativeSource({
        hyperliquidCoin: '',
        isNative: true,
        marketDataSource: undefined,
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

  it('keeps non-whitelisted sources on Market', () => {
    expect(
      getMarketDetailTradingViewNativeSource({
        hyperliquidCoin: '',
        marketDataSource: 'polling',
        networkId: 'evm--1',
        symbol: '',
        tokenAddress: '',
      }),
    ).toEqual({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '',
      symbol: '',
      realtime: 'disabled',
    });
  });
});
