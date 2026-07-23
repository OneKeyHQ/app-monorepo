import type { INativeMarketTradingViewPreloadPolicy } from './nativeMarketTradingViewPreloadPolicy.types';

export function getNativeMarketTradingViewPreloadPolicy(): INativeMarketTradingViewPreloadPolicy {
  return {
    enabled: false,
    delayMs: 0,
  };
}
