// cspell:ignore Stoch RSI
import { calculateTradingViewNativeStochasticRsi } from './stochasticRsi';
import {
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative StochRSI indicator', () => {
  it('calculates K and D and carries a valid raw value across a flat range', () => {
    const result = calculateTradingViewNativeStochasticRsi(
      [1, 2, 1, 2, 3, 2, 1, 2, 3, 4, 4],
      { dPeriod: 2, kPeriod: 2, rsiPeriod: 2, stochasticPeriod: 2 },
    );

    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.k, [
      null,
      null,
      null,
      null,
      100,
      50,
      0,
      50,
      100,
      100,
      100,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.d, [
      null,
      null,
      null,
      null,
      null,
      75,
      25,
      25,
      75,
      100,
      100,
    ]);
  });

  it('uses the legacy 14 / 14 / 3 / 3 default warm-up boundaries', () => {
    const values = Array.from(
      { length: 40 },
      (_, index) => 100 + index * 0.5 + Math.sin(index * 0.7) * 2,
    );
    const result = calculateTradingViewNativeStochasticRsi(values);

    expect(getFirstTradingViewNativeFiniteValueIndex(result.k)).toBe(29);
    expect(getFirstTradingViewNativeFiniteValueIndex(result.d)).toBe(31);
  });

  it('does not emit non-finite values after invalid input', () => {
    const result = calculateTradingViewNativeStochasticRsi([1, Number.NaN, 2]);

    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.k);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.d);
  });

  it('normalizes a tiny but non-zero RSI range instead of treating it as flat', () => {
    const result = calculateTradingViewNativeStochasticRsi([0, 1, 0, 1e-12], {
      dPeriod: 1,
      kPeriod: 1,
      rsiPeriod: 2,
      stochasticPeriod: 2,
    });

    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.k, [
      null,
      null,
      null,
      100,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.d, [
      null,
      null,
      null,
      100,
    ]);
  });
});
