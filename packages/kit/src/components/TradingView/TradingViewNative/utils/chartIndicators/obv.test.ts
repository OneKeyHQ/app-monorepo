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

  it('counts zero volume as nothing traded by default', () => {
    const result = calculateTradingViewNativeOnBalanceVolume(
      buildTradingViewNativeIndicatorTestPoints(
        [1, 2, 3, 4, 3, 5],
        [10, 20, 0, 0, 30, 40],
      ),
      2,
    );

    expect(result.obv).toEqual([0, 20, 20, 20, -10, 30]);
    expect(result.movingAverage).toEqual([null, 10, 20, 20, 5, 10]);
  });

  it('draws nothing on bars without volume and resumes from the last value', () => {
    const result = calculateTradingViewNativeOnBalanceVolume(
      buildTradingViewNativeIndicatorTestPoints(
        [1, 2, 3, 4, 3, 5],
        [10, 20, 0, 0, 30, 40],
      ),
      2,
      { zeroVolumeIsMissing: true },
    );

    // The bar at index 4 compares with the close of index 1, the last bar
    // that had volume, so it adds its volume instead of subtracting it.
    expect(result.obv).toEqual([0, 20, null, null, 50, 90]);
    expect(result.movingAverage).toEqual([null, 10, null, null, 35, 70]);
  });

  it('leaves out a bar with missing volume without restarting', () => {
    const result = calculateTradingViewNativeOnBalanceVolume(
      buildTradingViewNativeIndicatorTestPoints(
        [1, 2, 3, 4],
        [10, 20, Number.NaN, 40],
      ),
      2,
    );

    expect(result.obv).toEqual([0, 20, null, 60]);
    expect(result.movingAverage).toEqual([null, 10, null, 40]);
  });

  it('draws nothing when no bar has volume', () => {
    const result = calculateTradingViewNativeOnBalanceVolume(
      buildTradingViewNativeIndicatorTestPoints([1, 2, 3], [0, 0, 0]),
      2,
      { zeroVolumeIsMissing: true },
    );

    expect(result.obv).toEqual([null, null, null]);
    expect(result.movingAverage).toEqual([null, null, null]);
  });
});
