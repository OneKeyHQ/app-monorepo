import { getTradingViewNativeSourceKey } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/getTradingViewNativeSource';

import { getMarketDetailTradingViewNativeSource } from './getMarketDetailTradingViewNativeSource';
import { getMarketStockChartPreviousClose } from './marketStockPreviousClose';

describe('Market detail TradingViewNative source', () => {
  it('uses the token identity for a native Top Coin', () => {
    expect(
      getMarketDetailTradingViewNativeSource({
        hyperliquidCoin: '',
        isNative: true,
        marketDataSource: 'polling',
        networkId: 'doge--0',
        symbol: 'DOGE',
        tokenAddress: '',
      }),
    ).toEqual({
      kind: 'market',
      isNative: true,
      networkId: 'doge--0',
      tokenAddress: '',
      symbol: 'DOGE',
      realtime: 'disabled',
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

  it.each([undefined, 'polling', 'websocket'] as const)(
    'uses SOL candles with %s Market transport and no Hyperliquid ticker metadata',
    (marketDataSource) => {
      const source = getMarketDetailTradingViewNativeSource({
        hyperliquidCoin: '',
        isNative: true,
        marketDataSource,
        networkId: 'sol--101',
        symbol: 'SOL',
        tokenAddress: '',
      });

      expect(source).toEqual({
        kind: 'hyperliquid',
        coin: 'SOL',
        environment: 'mainnet',
      });
      expect(getTradingViewNativeSourceKey(source)).toBe(
        'hyperliquid:mainnet:SOL',
      );
    },
  );

  it('keeps wrapped SOL on Market even when its symbol is SOL', () => {
    const tokenAddress = 'So11111111111111111111111111111111111111112';
    const source = getMarketDetailTradingViewNativeSource({
      hyperliquidCoin: '',
      isNative: false,
      marketDataSource: 'websocket',
      networkId: 'sol--101',
      symbol: 'SOL',
      tokenAddress,
    });

    expect(source).toEqual({
      kind: 'market',
      networkId: 'sol--101',
      tokenAddress,
      symbol: 'SOL',
      realtime: 'websocket',
    });
    expect(getTradingViewNativeSourceKey(source)).toBe(
      `market:sol--101:${tokenAddress}`,
    );
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

describe('stock detail Pro chart price mode', () => {
  const params = {
    stockId: 'AAPL',
    hyperliquidCoin: '',
    marketDataSource: 'polling' as const,
    networkId: 'evm--1',
    symbol: 'AAPLx',
    tokenAddress: '0xabc',
  };

  it('switches Share → Token → Share with matching sources, keys and close prices', () => {
    const expected = {
      share: { kind: 'stock', stockId: 'AAPL' },
      token: {
        kind: 'market',
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        symbol: 'AAPLx',
        realtime: 'disabled',
      },
    };
    const keys: string[] = [];
    for (const priceMode of ['share', 'token', 'share'] as const) {
      const source = getMarketDetailTradingViewNativeSource({
        ...params,
        priceMode,
      });
      expect(source).toEqual(expected[priceMode]);
      keys.push(getTradingViewNativeSourceKey(source));
      expect(
        getMarketStockChartPreviousClose({
          priceSource: priceMode,
          stockDetail: { previousClose: '200' },
          selectedTokenVariant: {
            networkId: params.networkId,
            contractAddress: params.tokenAddress,
            tokenToAssetRatio: '0.5',
          },
        }),
      ).toBe(priceMode === 'share' ? 200 : 100);
    }
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0]).toBe(keys[2]);
  });

  it('keeps the share series when switching token variants, and switches stock identities', () => {
    expect(
      getMarketDetailTradingViewNativeSource({
        ...params,
        priceMode: 'share',
        networkId: 'evm--56',
        tokenAddress: '0xdef',
      }),
    ).toEqual({ kind: 'stock', stockId: 'AAPL' });
    expect(
      getMarketDetailTradingViewNativeSource({
        ...params,
        priceMode: 'share',
        stockId: 'TSLA',
      }),
    ).toEqual({ kind: 'stock', stockId: 'TSLA' });
  });

  it('can display a share without a loaded token variant', () => {
    expect(
      getMarketDetailTradingViewNativeSource({
        ...params,
        priceMode: 'share',
        networkId: '',
        tokenAddress: '',
      }),
    ).toEqual({ kind: 'stock', stockId: 'AAPL' });
  });

  it('uses token data without a listing id', () => {
    expect(
      getMarketDetailTradingViewNativeSource({
        ...params,
        stockId: undefined,
        priceMode: 'share',
      }).kind,
    ).toBe('market');
  });
});
