// cspell:ignore Donchian VWAP
import { calculateTradingViewNativeDonchianChannel } from './donchian';
import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
} from './testUtils';
import { calculateTradingViewNativeVolumeWeightedAveragePrice } from './vwap';

describe('TradingViewNative VWAP and Donchian channel indicators', () => {
  it('weighs the typical price of the latest bars by volume', () => {
    const points = [
      { c: 9, h: 12, l: 6, o: 8, t: 1, v: 1 },
      { c: 12, h: 20, l: 10, o: 9, t: 2, v: 3 },
      { c: 30, h: 33, l: 27, o: 12, t: 3, v: 1 },
    ];

    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeVolumeWeightedAveragePrice(points, 2),
      [null, (9 + 14 * 3) / 4, (14 * 3 + 30) / 4],
    );
  });

  it('has no VWAP while a bar of the window has no volume value', () => {
    const points = buildTradingViewNativeIndicatorTestPoints(
      [10, 20, 30],
      [1, Number.NaN, 1],
    );

    expect(
      calculateTradingViewNativeVolumeWeightedAveragePrice(points, 2),
    ).toEqual([null, null, null]);
  });

  it('tracks the highest high, the lowest low and their midpoint', () => {
    // The test points have a high one above and a low one below their close.
    const channel = calculateTradingViewNativeDonchianChannel(
      buildTradingViewNativeIndicatorTestPoints([5, 3, 8, 6]),
      2,
    );

    expect(channel.upper).toEqual([null, 6, 9, 9]);
    expect(channel.lower).toEqual([null, 2, 2, 5]);
    expect(channel.basis).toEqual([null, 4, 5.5, 7]);
  });
});
