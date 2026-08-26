import { getTradingViewNativeMarketTokenKey } from '../getTradingViewNativeSource';

import {
  clearTradingViewNativeCoinGeckoDataProviderCache,
  createTradingViewNativeCoinGeckoDataProvider,
} from './coinGecko/coinGeckoDataProvider';
import { createTradingViewNativeHyperliquidDataProvider } from './hyperliquid/hyperliquidDataProvider';
import {
  clearTradingViewNativeMarketDataProviderCache,
  createTradingViewNativeMarketDataProvider,
} from './market/marketDataProvider';

import type { ITradingViewNativeDataProvider } from './types';
import type { ITradingViewNativeSource } from '../../types';

export function clearTradingViewNativeDataProviderCache() {
  clearTradingViewNativeCoinGeckoDataProviderCache();
  clearTradingViewNativeMarketDataProviderCache();
}

export function createTradingViewNativeDataProvider(
  source: ITradingViewNativeSource,
): ITradingViewNativeDataProvider {
  if (source.kind === 'hyperliquid') {
    return createTradingViewNativeHyperliquidDataProvider(source);
  }

  const normalizedFallbackCoinGeckoId = source.fallbackCoinGeckoId?.trim();
  const fallbackHistoryProvider = createTradingViewNativeCoinGeckoDataProvider(
    normalizedFallbackCoinGeckoId
      ? { coinGeckoId: normalizedFallbackCoinGeckoId }
      : {
          networkId: source.networkId,
          tokenAddress: source.tokenAddress,
          tokenKey: getTradingViewNativeMarketTokenKey(source),
        },
  );
  return createTradingViewNativeMarketDataProvider({
    fallbackHistoryProvider,
    source,
  });
}
