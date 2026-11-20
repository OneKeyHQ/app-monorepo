// cspell:ignore VWMA WMA
import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
} from './testUtils';
import { calculateTradingViewNativeVolumeWeightedMovingAverage } from './vwma';
import { calculateTradingViewNativeWeightedMovingAverage } from './wma';

describe('TradingViewNative WMA and VWMA indicators', () => {
  it('weighs the latest bar of a linear weighted average the most', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeWeightedMovingAverage([1, 2, 3, 4], 3),
      [null, null, 14 / 6, 20 / 6],
    );
  });

  it('skips windows of a weighted average that hold an invalid value', () => {
    expect(
      calculateTradingViewNativeWeightedMovingAverage(
        [1, Number.NaN, 3, 4, 5],
        2,
      ),
    ).toEqual([null, null, null, (3 + 2 * 4) / 3, (4 + 2 * 5) / 3]);
  });

  it('weighs each close of a volume weighted average by its volume', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeVolumeWeightedMovingAverage(
        buildTradingViewNativeIndicatorTestPoints([10, 20, 30], [1, 3, 0]),
        2,
      ),
      [null, 17.5, 20],
    );
  });

  it('has no volume weighted average for a window that traded nothing', () => {
    expect(
      calculateTradingViewNativeVolumeWeightedMovingAverage(
        buildTradingViewNativeIndicatorTestPoints([10, 20], [0, 0]),
        2,
      ),
    ).toEqual([null, null]);
  });
});
