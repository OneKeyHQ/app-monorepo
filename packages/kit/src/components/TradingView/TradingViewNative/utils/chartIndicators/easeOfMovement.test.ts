// cspell:ignore EOM
import { calculateTradingViewNativeEaseOfMovement } from './easeOfMovement';
import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative Ease of Movement indicator', () => {
  it('smooths raw Ease of Movement values with an SMA', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeEaseOfMovement(
        buildTradingViewNativeIndicatorTestPoints(
          [1, 2, 4, 7],
          [10_000, 10_000, 10_000, 10_000],
        ),
        { period: 2 },
      ),
      [null, null, 3, 5],
    );
  });

  it('uses the legacy default 14-bar smoothing period', () => {
    const points = buildTradingViewNativeIndicatorTestPoints(
      Array.from({ length: 15 }, (_, index) => index + 1),
      Array.from({ length: 15 }, () => 10_000),
    );

    expect(
      getFirstTradingViewNativeFiniteValueIndex(
        calculateTradingViewNativeEaseOfMovement(points),
      ),
    ).toBe(14);
  });

  it('returns null instead of dividing by zero volume', () => {
    const points = buildTradingViewNativeIndicatorTestPoints([1, 2], [10, 0]);
    const result = calculateTradingViewNativeEaseOfMovement(points, {
      period: 1,
    });

    expect(result).toEqual([null, null]);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result);
  });

  it('calculates with tiny but non-zero volume', () => {
    const points = buildTradingViewNativeIndicatorTestPoints(
      [1, 2],
      [1e-11, 1e-11],
    );

    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeEaseOfMovement(points, {
        divisor: 1,
        period: 1,
      }),
      [null, 200_000_000_000],
    );
  });
});
