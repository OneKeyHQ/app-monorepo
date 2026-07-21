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

  it('does not wait for token detail before mounting an ordinary Market source', () => {
    expect(
      getSwapKLineTradingViewNativeSource({
        isTokenMarketInfoLoading: true,
        token: buildToken({
          contractAddress: '',
          networkId: 'hype--mainnet',
          symbol: 'HYPE',
        }),
      }),
    ).toEqual({
      kind: 'market',
      networkId: 'hype--mainnet',
      tokenAddress: '',
      symbol: 'HYPE',
      realtime: 'disabled',
    });
  });

  it('waits for native BTC metadata before choosing its provider', () => {
    expect(
      getSwapKLineTradingViewNativeSource({
        isTokenMarketInfoLoading: true,
        token: buildToken(),
      }),
    ).toBeUndefined();
  });

  it('keeps chart fallback ownership out of the Swap source', () => {
    const source = getSwapKLineTradingViewNativeSource({
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
    });
    expect(getSwapKLineTradingViewNativeSourceKey(source)).toBe(
      'market:evm--1:0xabc:ETH',
    );
  });

  it('passes stock token identity through the shared Market provider', () => {
    expect(
      getSwapKLineTradingViewNativeSource({
        token: buildToken({
          contractAddress: 'stock-aapl',
          isNative: false,
          isStock: true,
          networkId: 'stock--0',
          symbol: 'AAPL',
        }),
      }),
    ).toEqual({
      kind: 'market',
      networkId: 'stock--0',
      tokenAddress: 'stock-aapl',
      symbol: 'AAPL',
      realtime: 'disabled',
    });
  });

  it('keeps Market history available when realtime is unavailable', () => {
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
