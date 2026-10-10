import type { ITradingViewNativeSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';

import { resolveMarketKlineLivePriceEnabled } from './marketKlineLivePrice';

/**
 * Native market charts without websocket quotes cannot keep the header live
 * after their initial history, so the K-line poll stands in for their feed on
 * the same selected token. Simple charts run their own poll, so the fallback
 * only runs while the native chart is the mounted chart.
 */
export function resolveMarketNativeChartFallbackQuoteEnabled({
  active,
  isTradingViewNative,
  isNativeChartMounted = true,
  source,
  isNative,
  networkId,
  tokenAddress,
}: {
  active?: boolean;
  isTradingViewNative: boolean;
  isNativeChartMounted?: boolean;
  source: ITradingViewNativeSource;
  isNative?: boolean;
  networkId: string;
  tokenAddress: string;
}): boolean {
  return (
    active !== false &&
    isTradingViewNative &&
    isNativeChartMounted &&
    source.kind === 'market' &&
    source.realtime !== 'websocket' &&
    resolveMarketKlineLivePriceEnabled({
      isNative,
      networkId,
      priceMode: 'token',
      tokenAddress,
    })
  );
}
