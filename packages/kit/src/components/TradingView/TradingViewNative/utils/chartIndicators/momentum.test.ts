// cspell:ignore MTM
import { calculateTradingViewNativeMomentum } from './momentum';
import {
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative MTM indicator', () => {
  it('calculates absolute change from the period-offset close', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeMomentum([10, 12, 15, 18], 2),
      [null, null, 5, 6],
    );
  });

  it('uses the legacy default 10-bar period', () => {
    const values = Array.from({ length: 11 }, (_, index) => index + 1);

    expect(
      getFirstTradingViewNativeFiniteValueIndex(
        calculateTradingViewNativeMomentum(values),
      ),
    ).toBe(10);
  });

  it('returns null when the period-offset close is zero', () => {
    const result = calculateTradingViewNativeMomentum([0, 1], 1);

    expect(result).toEqual([null, null]);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result);
  });

  it('keeps finite output when the period-offset close is tiny but non-zero', () => {
    expect(calculateTradingViewNativeMomentum([1e-11, 2e-11], 1)).toEqual([
      null,
      1e-11,
    ]);
  });
});
