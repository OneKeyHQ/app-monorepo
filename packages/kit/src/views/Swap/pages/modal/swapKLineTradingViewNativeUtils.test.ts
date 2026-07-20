import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  getSwapKLineTradingViewNativeSource,
  getSwapKLineTradingViewNativeSourceKey,
  resolveSwapKLineTokenMarketInfo,
} from './swapKLineTradingViewNativeUtils';

function buildToken(overrides: Partial<ISwapToken> = {}): ISwapToken {
  return {
    contractAddress: '',
    decimals: 8,
    isNative: true,
    networkId: 'btc--0',
    symbol: 'BTC',
    ...overrides,
  } as ISwapToken;
}

describe('Swap K-line TradingViewNative source', () => {
  it('uses Hyperliquid for native BTC when the token detail configures it', () => {
    const source = getSwapKLineTradingViewNativeSource({
      perpsInfo: { hlTicker: 'BTC' },
      token: buildToken(),
      websocketConfig: { kline: true, txs: true },
    });

    expect(source).toEqual({
      kind: 'hyperliquid',
      coin: 'BTC',
      environment: 'mainnet',
    });
    expect(getSwapKLineTradingViewNativeSourceKey(source)).toBe(
      'hyperliquid:mainnet:BTC',
    );
  });

  it('uses Market WebSocket for configured ordinary tokens', () => {
    const source = getSwapKLineTradingViewNativeSource({
      perpsInfo: { hlTicker: 'ETH' },
      token: buildToken({
        contractAddress: '0xabc',
        decimals: 18,
        isNative: false,
        networkId: 'evm--1',
        symbol: 'TOKEN',
      }),
      websocketConfig: { kline: true, txs: false },
    });

    expect(source).toEqual({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'websocket',
    });
  });

  it('adds CoinGecko as a fallback for ordinary Market history', () => {
    const source = getSwapKLineTradingViewNativeSource({
      coinGeckoId: 'ethereum',
      token: buildToken({
        contractAddress: '0xAbC',
        isNative: false,
        networkId: 'evm--1',
        symbol: 'eth',
      }),
    });

    expect(source).toEqual({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '0xAbC',
      symbol: 'eth',
      realtime: 'disabled',
      history: {
        provider: 'market',
        fallback: {
          provider: 'coinGecko',
          coinGeckoId: 'ethereum',
        },
      },
    });
    expect(getSwapKLineTradingViewNativeSourceKey(source)).toBe(
      'market:evm--1:0xabc:ETH',
    );
  });

  it('uses CoinGecko-only history for stock tokens', () => {
    const source = getSwapKLineTradingViewNativeSource({
      coinGeckoId: 'apple',
      preferCoinGecko: true,
      token: buildToken({
        contractAddress: 'stock-aapl',
        isNative: false,
        isStock: true,
        networkId: 'stock--0',
        symbol: 'AAPL',
      }),
    });

    expect(source).toEqual({
      kind: 'market',
      networkId: 'stock--0',
      tokenAddress: 'stock-aapl',
      symbol: 'AAPL',
      realtime: 'disabled',
      history: {
        provider: 'coinGecko',
        coinGeckoId: 'apple',
      },
    });
    expect(getSwapKLineTradingViewNativeSourceKey(source)).toBe(
      'market:stock--0:stock-aapl:AAPL:history:coinGecko:apple',
    );
  });

  it('does not fall through to Market history while stock metadata is unavailable', () => {
    expect(
      getSwapKLineTradingViewNativeSource({
        preferCoinGecko: true,
        token: buildToken({
          isNative: false,
          isStock: true,
          networkId: 'stock--0',
          symbol: 'AAPL',
        }),
      }),
    ).toBeUndefined();
  });

  it('keeps a Market history-only fallback when realtime is unavailable', () => {
    expect(
      getSwapKLineTradingViewNativeSource({
        token: buildToken({
          isNative: true,
          networkId: 'evm--1',
          symbol: 'ETH',
        }),
      }),
    ).toEqual({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '',
      symbol: 'ETH',
      realtime: 'disabled',
    });
  });
});

describe('Swap K-line token detail source state', () => {
  const btcResult = {
    status: 'success' as const,
    perpsInfo: { hlTicker: 'BTC' },
    tokenKey: 'btc--0::native',
    tokenMarketDetail: { symbol: 'BTC' } as IMarketTokenDetail,
    updatedAt: 100,
    websocketConfig: { kline: true, txs: true },
  };

  it('keeps a new token pending while the hook still exposes the old token result', () => {
    expect(
      resolveSwapKLineTokenMarketInfo({
        enabled: true,
        networkId: 'btc--0',
        result: { ...btcResult, tokenKey: 'evm--1:0xabc:contract' },
        tokenKey: btcResult.tokenKey,
      }),
    ).toEqual({
      isLoading: true,
      perpsInfo: undefined,
      tokenMarketDetail: undefined,
      updatedAt: undefined,
      websocketConfig: undefined,
    });
  });

  it('retains the last-good source config after a polling failure', () => {
    expect(
      resolveSwapKLineTokenMarketInfo({
        enabled: true,
        lastGoodResult: btcResult,
        networkId: 'btc--0',
        result: { status: 'error', tokenKey: btcResult.tokenKey },
        tokenKey: btcResult.tokenKey,
      }),
    ).toEqual({
      isLoading: false,
      perpsInfo: { hlTicker: 'BTC' },
      tokenMarketDetail: { symbol: 'BTC' },
      updatedAt: 100,
      websocketConfig: { kline: true, txs: true },
    });
  });

  it('finishes the initial request after an error when no last-good config exists', () => {
    expect(
      resolveSwapKLineTokenMarketInfo({
        enabled: true,
        networkId: 'evm--1',
        result: { status: 'error', tokenKey: 'evm--1:0xabc:contract' },
        tokenKey: 'evm--1:0xabc:contract',
      }).isLoading,
    ).toBe(false);
  });
});
