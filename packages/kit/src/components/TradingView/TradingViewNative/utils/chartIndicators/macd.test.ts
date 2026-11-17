// cspell:ignore macd
import { calculateTradingViewNativeMacd } from './macd';
import {
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative MACD indicator', () => {
  it('calculates the three outputs without doubling the histogram', () => {
    const result = calculateTradingViewNativeMacd([1, 2, 3, 4, 5], {
      fastPeriod: 2,
      signalPeriod: 2,
      slowPeriod: 3,
    });

    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.macd, [
      null,
      null,
      0.5,
      0.5,
      0.5,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.signal, [
      null,
      null,
      null,
      0.5,
      0.5,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.histogram, [
      null,
      null,
      null,
      0,
      0,
    ]);
  });

  it('uses the legacy 12 / 26 / 9 default warm-up boundaries', () => {
    const values = Array.from({ length: 40 }, (_, index) => index + 1);
    const result = calculateTradingViewNativeMacd(values);

    expect(getFirstTradingViewNativeFiniteValueIndex(result.macd)).toBe(25);
    expect(getFirstTradingViewNativeFiniteValueIndex(result.signal)).toBe(33);
    expect(getFirstTradingViewNativeFiniteValueIndex(result.histogram)).toBe(
      33,
    );
  });

  it('does not emit non-finite values after invalid input', () => {
    const result = calculateTradingViewNativeMacd([1, Number.NaN, 2]);

    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.macd);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.signal);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.histogram);
  });
});
