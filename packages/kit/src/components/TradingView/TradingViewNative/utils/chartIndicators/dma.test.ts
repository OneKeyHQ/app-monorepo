// cspell:ignore BRAR DMA
import { calculateTradingViewNativeBrar } from './brar';
import { calculateTradingViewNativeDma } from './dma';
import { calculateTradingViewNativePsychologicalLine } from './psy';
import { calculateTradingViewNativePriceVolumeTrend } from './pvt';
import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
} from './testUtils';
import { calculateTradingViewNativeVolumeRatio } from './vr';

describe('TradingViewNative DMA, VR, BRAR, PSY and PVT indicators', () => {
  it('subtracts the long average from the short one and averages the difference', () => {
    const { dif, movingAverage } = calculateTradingViewNativeDma(
      [1, 2, 3, 4, 5, 6],
      { longPeriod: 4, movingAveragePeriod: 2, shortPeriod: 2 },
    );

    expect(dif).toEqual([null, null, null, 1, 1, 1]);
    expect(movingAverage).toEqual([null, null, null, null, 1, 1]);
  });

  it('splits unchanged volume between both sides of the volume ratio', () => {
    const { movingAverage, vr } = calculateTradingViewNativeVolumeRatio(
      buildTradingViewNativeIndicatorTestPoints(
        [10, 11, 10, 10, 12],
        [5, 10, 20, 30, 40],
      ),
      { movingAveragePeriod: 2, period: 2 },
    );

    expectTradingViewNativeIndicatorValuesToBeCloseTo(vr, [
      null,
      null,
      (100 * 10) / 20,
      (100 * 15) / 35,
      (100 * 55) / 15,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(movingAverage, [
      null,
      null,
      null,
      (50 + 1500 / 35) / 2,
      (1500 / 35 + 5500 / 15) / 2,
    ]);
  });

  it('has no volume ratio when nothing traded on falling bars', () => {
    const { vr } = calculateTradingViewNativeVolumeRatio(
      buildTradingViewNativeIndicatorTestPoints([1, 2, 3, 4], [1, 1, 1, 1]),
      { period: 2 },
    );

    expect(vr).toEqual([null, null, null, null]);
  });

  it('measures BR from the previous close and AR from the open', () => {
    const points = [
      { c: 11, h: 12, l: 9, o: 10, t: 1, v: 1 },
      { c: 14, h: 15, l: 10, o: 11, t: 2, v: 1 },
      { c: 13, h: 14, l: 13, o: 13, t: 3, v: 1 },
    ];
    const { ar, br } = calculateTradingViewNativeBrar(points, 1);

    // The last bar opens at its low, so AR has nothing to divide by.
    expect(ar).toEqual([200, 400, null]);
    expect(br).toEqual([null, 400, 0]);
  });

  it('counts the share of rising bars for the psychological line', () => {
    const { movingAverage, psy } = calculateTradingViewNativePsychologicalLine(
      [1, 2, 3, 2, 3],
      { movingAveragePeriod: 2, period: 2 },
    );

    expect(psy).toEqual([null, null, 100, 50, 50]);
    expect(movingAverage).toEqual([null, null, null, 75, 50]);
  });

  it('accumulates volume scaled by the relative close change', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativePriceVolumeTrend(
        buildTradingViewNativeIndicatorTestPoints(
          [10, 11, 9.9],
          [100, 200, 300],
        ),
      ),
      [0, 20, -10],
    );
  });

  it('leaves a bar without volume empty and carries the trend total on', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativePriceVolumeTrend(
        buildTradingViewNativeIndicatorTestPoints(
          [10, 11, 11, 12.1],
          [100, 200, Number.NaN, 300],
        ),
      ),
      [0, 20, null, 50],
    );
  });
});
