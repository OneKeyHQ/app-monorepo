import { calculateTradingViewNativeAverageTrueRange } from './atr';
import { calculateTradingViewNativeBullBearPower } from './bullBearPower';
import {
  calculateTradingViewNativeLinearRegression,
  calculateTradingViewNativeRollingStandardDeviation,
  calculateTradingViewNativeTrueRange,
} from './indicatorMath';
import { calculateTradingViewNativeMassIndex } from './massIndex';
import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative range based indicators', () => {
  const points = [
    { c: 9, h: 10, l: 8, o: 9, t: 1, v: 1 },
    { c: 11, h: 12, l: 9, o: 9, t: 2, v: 1 },
    { c: 8, h: 11, l: 7, o: 11, t: 3, v: 1 },
    { c: 7, h: 9, l: 6, o: 8, t: 4, v: 1 },
  ];

  it('takes the true range from the previous close as well as the bar', () => {
    expect(calculateTradingViewNativeTrueRange(points)).toEqual([
      null,
      3,
      4,
      3,
    ]);
  });

  it("smooths the true range with Wilder's average", () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeAverageTrueRange(points, 2),
      [null, null, 3.5, 3.25],
    );
  });

  it('adds bull power and bear power around the exponential average', () => {
    const flatPoints = [5, 5, 5].map((close, index) => ({
      c: close,
      h: close + 3,
      l: close - 1,
      o: close,
      t: index,
      v: 1,
    }));

    expect(calculateTradingViewNativeBullBearPower(flatPoints, 2)).toEqual([
      null,
      2,
      2,
    ]);
  });

  it('sums the range ratio of the mass index after both averages warm up', () => {
    const massIndex = calculateTradingViewNativeMassIndex(
      buildTradingViewNativeIndicatorTestPoints(
        Array.from({ length: 22 }, (_, index) => 100 + index),
      ),
      3,
    );

    // Two 9-bar exponential averages, then a 3-bar sum.
    expect(getFirstTradingViewNativeFiniteValueIndex(massIndex)).toBe(18);
    expect(massIndex[21]).toBeCloseTo(3, 10);
  });

  it('fits a regression line and a population deviation to full windows', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeLinearRegression([1, 3, 5, 9], 3),
      [null, null, 5, 26 / 3],
    );
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeRollingStandardDeviation([2, 4, 4, 8], 2),
      [null, 1, 0, 2],
    );
    expect(
      calculateTradingViewNativeLinearRegression([1, Number.NaN, 3], 2),
    ).toEqual([null, null, null]);
  });

  it('reports no deviation for a flat window whatever its level', () => {
    // 0.1 has no exact binary form, so averaging its squares would not cancel.
    for (const level of [0.1, 1e-9, 123_456.789]) {
      const deviations = calculateTradingViewNativeRollingStandardDeviation(
        Array.from({ length: 30 }, () => level),
        20,
      );
      expect(deviations.slice(19)).toEqual(Array.from({ length: 11 }, () => 0));
    }
  });

  it('keeps a small deviation around a large price', () => {
    const values = Array.from(
      { length: 20 },
      (_, index) => 1_000_000 + (index % 2 === 0 ? 0.001 : -0.001),
    );

    expect(
      calculateTradingViewNativeRollingStandardDeviation(values, 20)[19],
    ).toBeCloseTo(0.001, 9);
  });
});
