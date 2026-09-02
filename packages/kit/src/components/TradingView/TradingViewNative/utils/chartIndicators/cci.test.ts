// cspell:ignore CCI
import { calculateTradingViewNativeCommodityChannelIndex } from './cci';
import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative CCI indicator', () => {
  it('uses mean absolute deviation and calculates its hidden SMA', () => {
    const result = calculateTradingViewNativeCommodityChannelIndex(
      buildTradingViewNativeIndicatorTestPoints([1, 2, 3, 4]),
      { movingAveragePeriod: 2, period: 3 },
    );

    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.cci, [
      null,
      null,
      100,
      100,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.movingAverage, [
      null,
      null,
      null,
      100,
    ]);
  });

  it('uses the legacy default 20-bar periods', () => {
    const result = calculateTradingViewNativeCommodityChannelIndex(
      buildTradingViewNativeIndicatorTestPoints(
        Array.from({ length: 39 }, (_, index) => index + 1),
      ),
    );

    expect(getFirstTradingViewNativeFiniteValueIndex(result.cci)).toBe(19);
    expect(
      getFirstTradingViewNativeFiniteValueIndex(result.movingAverage),
    ).toBe(38);
  });

  it('returns null when mean deviation is zero', () => {
    const result = calculateTradingViewNativeCommodityChannelIndex(
      buildTradingViewNativeIndicatorTestPoints([1, 1, 1]),
      { period: 3 },
    );

    expect(result.cci).toEqual([null, null, null]);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.cci);
  });

  it('calculates a tiny but non-zero mean deviation', () => {
    const points = [1e-11, 2e-11, 3e-11].map((close, index) => ({
      c: close,
      h: close,
      l: close,
      o: close,
      t: index,
      v: 10,
    }));
    const result = calculateTradingViewNativeCommodityChannelIndex(points, {
      period: 3,
    });

    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.cci, [
      null,
      null,
      100,
    ]);
  });
});
