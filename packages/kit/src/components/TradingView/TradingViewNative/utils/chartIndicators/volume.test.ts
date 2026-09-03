import {
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';
import { calculateTradingViewNativeVolume } from './volume';

describe('TradingViewNative VOL indicator', () => {
  it('calculates volume and both hidden smoothing lines', () => {
    const result = calculateTradingViewNativeVolume([10, 20, 30, 40], 2, 2);

    expect(result.volume).toEqual([10, 20, 30, 40]);
    expect(result.movingAverage).toEqual([null, 15, 25, 35]);
    expect(result.smoothedMovingAverage).toEqual([null, null, 20, 30]);
  });

  it('uses the legacy default 20-bar moving average', () => {
    const result = calculateTradingViewNativeVolume(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );

    expect(
      getFirstTradingViewNativeFiniteValueIndex(result.movingAverage),
    ).toBe(19);
    expect(result.smoothedMovingAverage).toEqual(
      Array.from({ length: 20 }, () => null),
    );
  });

  it('normalizes invalid values to null', () => {
    const result = calculateTradingViewNativeVolume([
      1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]);

    expect(result.volume).toEqual([1, null, null]);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(
      result.movingAverage,
    );
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(
      result.smoothedMovingAverage,
    );
  });
});
