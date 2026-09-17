// cspell:ignore RSI
import { calculateTradingViewNativeRelativeStrengthIndex } from './rsi';
import {
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative RSI indicator', () => {
  it('uses Wilder averages and preserves the bundle zero rules', () => {
    const result = calculateTradingViewNativeRelativeStrengthIndex(
      [1, 2, 3, 2, 2],
      { movingAveragePeriod: 2, period: 2 },
    );

    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.rsi, [
      null,
      null,
      100,
      50,
      50,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.movingAverage, [
      null,
      null,
      null,
      75,
      50,
    ]);
    expect(
      calculateTradingViewNativeRelativeStrengthIndex([1, 1, 1], {
        period: 2,
      }).rsi,
    ).toEqual([null, null, 100]);
  });

  it('uses the legacy 14-bar default periods', () => {
    const values = Array.from({ length: 30 }, (_, index) => index + 1);
    const result = calculateTradingViewNativeRelativeStrengthIndex(values);

    expect(getFirstTradingViewNativeFiniteValueIndex(result.rsi)).toBe(14);
    expect(
      getFirstTradingViewNativeFiniteValueIndex(result.movingAverage),
    ).toBe(27);
  });

  it('does not emit non-finite values after invalid input', () => {
    const result = calculateTradingViewNativeRelativeStrengthIndex([
      1,
      Number.NaN,
      2,
    ]);

    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.rsi);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(
      result.movingAverage,
    );
  });
});
