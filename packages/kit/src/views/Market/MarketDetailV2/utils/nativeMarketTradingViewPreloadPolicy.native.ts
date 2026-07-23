import {
  getDeviceMemoryGBSync,
  isLowEndMemory,
} from '@onekeyhq/shared/src/performance/deviceMemory';

import type { INativeMarketTradingViewPreloadPolicy } from './nativeMarketTradingViewPreloadPolicy.types';

export const MARKET_NATIVE_TV_HIGH_TIER_PRELOAD_DELAY_MS = 600;
export const MARKET_NATIVE_TV_MEDIUM_TIER_PRELOAD_DELAY_MS = 1200;
const MARKET_NATIVE_TV_HIGH_MEMORY_THRESHOLD_GB = 4;

export function resolveNativeMarketTradingViewPreloadPolicy(
  memoryGB: number | null,
): INativeMarketTradingViewPreloadPolicy {
  if (memoryGB !== null && isLowEndMemory(memoryGB)) {
    return {
      enabled: false,
      delayMs: 0,
    };
  }

  return {
    enabled: true,
    delayMs:
      memoryGB !== null && memoryGB >= MARKET_NATIVE_TV_HIGH_MEMORY_THRESHOLD_GB
        ? MARKET_NATIVE_TV_HIGH_TIER_PRELOAD_DELAY_MS
        : MARKET_NATIVE_TV_MEDIUM_TIER_PRELOAD_DELAY_MS,
  };
}

export function getNativeMarketTradingViewPreloadPolicy(): INativeMarketTradingViewPreloadPolicy {
  return resolveNativeMarketTradingViewPreloadPolicy(getDeviceMemoryGBSync());
}
