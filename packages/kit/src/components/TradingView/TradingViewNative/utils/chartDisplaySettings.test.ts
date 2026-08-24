import {
  formatTradingViewNativeCandleCountdown,
  getTradingViewNativeCurrentPriceDisplayLabel,
} from './chartDisplaySettings';

describe('TradingViewNative chart display settings', () => {
  it('formats the remaining candle duration without wrapping long hours', () => {
    expect(
      formatTradingViewNativeCandleCountdown({
        candleIntervalSeconds: 604_800,
        candleTimestamp: 1_700_000_000,
        now: 1_700_000_001_000,
      }),
    ).toBe('167:59:59');
  });

  it('appends the countdown to the current price when enabled', () => {
    const points = [{ c: 101, h: 103, l: 98, o: 100, t: 1_700_000_000, v: 10 }];

    expect(
      getTradingViewNativeCurrentPriceDisplayLabel({
        candleIntervalSeconds: 60,
        countdown: true,
        now: 1_700_000_030_000,
        points,
      }),
    ).toBe('101.00 00:00:30');
    expect(
      getTradingViewNativeCurrentPriceDisplayLabel({
        candleIntervalSeconds: 60,
        countdown: false,
        now: 1_700_000_030_000,
        points,
      }),
    ).toBe('101.00');
  });
});
