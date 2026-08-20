// cspell:ignore ROC
import { calculateTradingViewNativeRateOfChange } from './rateOfChange';
import {
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative ROC indicator', () => {
  it('calculates percentage change from the period-offset close', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeRateOfChange([10, 12, 15, 18], 2),
      [null, null, 50, 50],
    );
  });

  it('uses the legacy default 9-bar period', () => {
    const values = Array.from({ length: 10 }, (_, index) => index + 1);

    expect(
      getFirstTradingViewNativeFiniteValueIndex(
        calculateTradingViewNativeRateOfChange(values),
      ),
    ).toBe(9);
  });

  it('returns null when the period-offset close is zero', () => {
    const result = calculateTradingViewNativeRateOfChange([0, 1], 1);

    expect(result).toEqual([null, null]);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result);
  });

  it('keeps finite output when the period-offset close is tiny but non-zero', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeRateOfChange([1e-11, 2e-11], 1),
      [null, 100],
    );
  });
});
