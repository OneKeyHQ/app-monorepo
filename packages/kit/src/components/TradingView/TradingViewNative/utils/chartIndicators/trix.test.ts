// cspell:ignore TRIX
import {
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';
import { calculateTradingViewNativeTrix } from './trix';

describe('TradingViewNative TRIX indicator', () => {
  it('uses the bundle-compatible logarithmic triple EMA formula', () => {
    const values = Array.from({ length: 6 }, (_, index) => Math.exp(index));

    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeTrix(values, 2),
      [null, null, null, null, 10_000, 10_000],
    );
  });

  it('uses the legacy default 18-bar triple EMA warm-up', () => {
    const values = Array.from({ length: 53 }, (_, index) =>
      Math.exp(index / 100),
    );

    expect(
      getFirstTradingViewNativeFiniteValueIndex(
        calculateTradingViewNativeTrix(values),
      ),
    ).toBe(52);
  });

  it('returns null for non-positive and invalid source values', () => {
    const result = calculateTradingViewNativeTrix([1, 0, -1, Number.NaN]);

    expect(result).toEqual([null, null, null, null]);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result);
  });
});
