// cspell:ignore OBV
import { calculateTradingViewNativeOnBalanceVolume } from './obv';
import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative OBV indicator', () => {
  it('accumulates volume from zero and calculates its SMA', () => {
    const result = calculateTradingViewNativeOnBalanceVolume(
      buildTradingViewNativeIndicatorTestPoints([1, 2, 2, 1], [10, 20, 30, 40]),
      2,
    );

    expect(result.obv).toEqual([0, 20, 20, -20]);
    expect(result.movingAverage).toEqual([null, 10, 20, 0]);
  });

  it('uses the default 30-bar MAOBV period', () => {
    const points = buildTradingViewNativeIndicatorTestPoints(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    const result = calculateTradingViewNativeOnBalanceVolume(points);

    expect(
      getFirstTradingViewNativeFiniteValueIndex(result.movingAverage),
    ).toBe(29);
  });

  it('restarts accumulation after an invalid bar', () => {
    const points = buildTradingViewNativeIndicatorTestPoints([
      1,
      2,
      Number.NaN,
      3,
      4,
    ]);
    const result = calculateTradingViewNativeOnBalanceVolume(points);

    expect(result.obv).toEqual([0, 10, null, 0, 10]);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.obv);
  });
});
