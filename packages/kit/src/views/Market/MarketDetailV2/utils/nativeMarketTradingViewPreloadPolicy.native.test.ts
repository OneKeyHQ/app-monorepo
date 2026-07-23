import {
  MARKET_NATIVE_TV_HIGH_TIER_PRELOAD_DELAY_MS,
  MARKET_NATIVE_TV_MEDIUM_TIER_PRELOAD_DELAY_MS,
  resolveNativeMarketTradingViewPreloadPolicy,
} from './nativeMarketTradingViewPreloadPolicy.native';

describe('resolveNativeMarketTradingViewPreloadPolicy', () => {
  it('keeps one warmup WebView resident on high-memory devices', () => {
    expect(resolveNativeMarketTradingViewPreloadPolicy(6)).toEqual({
      enabled: true,
      delayMs: MARKET_NATIVE_TV_HIGH_TIER_PRELOAD_DELAY_MS,
    });
  });

  it('delays residency work on medium-memory devices', () => {
    expect(resolveNativeMarketTradingViewPreloadPolicy(3.75)).toEqual({
      enabled: true,
      delayMs: MARKET_NATIVE_TV_MEDIUM_TIER_PRELOAD_DELAY_MS,
    });
  });

  it('uses the medium policy when native memory is unavailable', () => {
    expect(resolveNativeMarketTradingViewPreloadPolicy(null)).toEqual({
      enabled: true,
      delayMs: MARKET_NATIVE_TV_MEDIUM_TIER_PRELOAD_DELAY_MS,
    });
  });

  it('does not keep a WebContent process warm on low-memory devices', () => {
    expect(resolveNativeMarketTradingViewPreloadPolicy(3)).toEqual({
      enabled: false,
      delayMs: 0,
    });
  });
});
