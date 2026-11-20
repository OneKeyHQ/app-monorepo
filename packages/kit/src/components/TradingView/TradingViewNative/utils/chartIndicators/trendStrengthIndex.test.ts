// cspell:ignore RCI
import { calculateTradingViewNativeRankCorrelationIndex } from './rci';
import { calculateTradingViewNativeRelativeVolatilityIndex } from './relativeVolatilityIndex';
import {
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';
import { calculateTradingViewNativeTrendStrengthIndex } from './trendStrengthIndex';

describe('TradingViewNative correlation and volatility indicators', () => {
  it('correlates the values with time for the trend strength index', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeTrendStrengthIndex([1, 2, 3, 2, 1], 3),
      [null, null, 1, 0, -1],
    );
  });

  it('has no trend strength for a flat window', () => {
    expect(
      calculateTradingViewNativeTrendStrengthIndex([5, 5, 5, 6], 3),
    ).toEqual([null, null, null, expect.any(Number)]);
  });

  it('ranks values against time for the rank correlation index', () => {
    // The middle window holds 2, 3, 2: its two equal values share rank 2.5.
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeRankCorrelationIndex([1, 2, 3, 2, 1], 3),
      [null, null, 100, 12.5, -100],
    );
  });

  it('shares the average rank between equal values', () => {
    // With every value tied the rank differences leave half the correlation.
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeRankCorrelationIndex([4, 4, 4, 4], 4),
      [null, null, null, 50],
    );
    expect(
      calculateTradingViewNativeRankCorrelationIndex([1, Number.NaN, 3], 2),
    ).toEqual([null, null, null]);
  });

  it('puts all the volatility of a steady move on one side', () => {
    const rising = Array.from({ length: 20 }, (_, index) => 100 + index ** 2);
    const up = calculateTradingViewNativeRelativeVolatilityIndex(rising, {
      period: 2,
      signalPeriod: 2,
    });
    const down = calculateTradingViewNativeRelativeVolatilityIndex(
      rising.toReversed(),
      { period: 2, signalPeriod: 2 },
    );

    // A 2-bar deviation from bar 1, then a 14-bar exponential average.
    expect(getFirstTradingViewNativeFiniteValueIndex(up.rvi)).toBe(14);
    expect(getFirstTradingViewNativeFiniteValueIndex(up.signal)).toBe(15);
    expect(up.rvi[19]).toBe(100);
    expect(up.signal[19]).toBe(100);
    expect(down.rvi[19]).toBe(0);
  });
});
