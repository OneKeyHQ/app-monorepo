// cspell:ignore KST NVI PMO
import { calculateTradingViewNativeKst } from './kst';
import { calculateTradingViewNativeMaSlope } from './maSlope';
import { calculateTradingViewNativeNegativeVolumeIndex } from './nvi';
import { calculateTradingViewNativePriceMomentumOscillator } from './pmo';
import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative KST, NVI, PMO and slope indicators', () => {
  it('weighs the four smoothed rates of change of KST by 1, 2, 3 and 4', () => {
    // Each close doubles, so every one-bar rate of change is 100.
    const { kst, signal } = calculateTradingViewNativeKst([1, 2, 4, 8], {
      rocPeriods: [1, 1, 1, 1],
      signalPeriod: 2,
      smoothingPeriods: [1, 1, 1, 1],
    });

    expect(kst).toEqual([null, 1000, 1000, 1000]);
    expect(signal).toEqual([null, null, 1000, 1000]);
  });

  it('waits for the slowest KST component', () => {
    const values = Array.from({ length: 60 }, (_, index) => 100 + index);
    const { kst, signal } = calculateTradingViewNativeKst(values);

    // A 30-bar rate of change smoothed over 15 bars, then a 9-bar signal.
    expect(getFirstTradingViewNativeFiniteValueIndex(kst)).toBe(44);
    expect(getFirstTradingViewNativeFiniteValueIndex(signal)).toBe(52);
  });

  it('moves the negative volume index only on bars with lower volume', () => {
    const { movingAverage, nvi } =
      calculateTradingViewNativeNegativeVolumeIndex(
        buildTradingViewNativeIndicatorTestPoints(
          [10, 11, 12.1, 12.1],
          [100, 50, 80, 40],
        ),
        3,
      );

    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      nvi,
      [1000, 1100, 1100, 1100],
    );
    // The average starts from the first value instead of a full window.
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      movingAverage,
      [1000, 1050, 1075, 1087.5],
    );
  });

  it('leaves a bar without volume out and compares the next bar across it', () => {
    const { movingAverage, nvi } =
      calculateTradingViewNativeNegativeVolumeIndex(
        buildTradingViewNativeIndicatorTestPoints(
          [10, 11, 12.1],
          [100, Number.NaN, 50],
        ),
        3,
      );

    // The last bar traded less than the first, 21% above its close.
    expectTradingViewNativeIndicatorValuesToBeCloseTo(nvi, [1000, null, 1210]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(movingAverage, [
      1000,
      null,
      1105,
    ]);
  });

  it('does not read a missing stock volume as a drop in volume', () => {
    const points = buildTradingViewNativeIndicatorTestPoints(
      [100, 110, 110],
      [1000, 0, 1000],
    );

    // Zero is a real volume by default, so the middle bar counts as a drop.
    expect(calculateTradingViewNativeNegativeVolumeIndex(points).nvi).toEqual([
      1000, 1100, 1100,
    ]);
    // A stock feed sends zero when it has no volume for the bar.
    expect(
      calculateTradingViewNativeNegativeVolumeIndex(points, 255, {
        zeroVolumeIsMissing: true,
      }).nvi,
    ).toEqual([1000, null, 1000]);
  });

  it('has no negative volume index for a source without volume', () => {
    const { movingAverage, nvi } =
      calculateTradingViewNativeNegativeVolumeIndex(
        buildTradingViewNativeIndicatorTestPoints([10, 11, 12], [0, 0, 0]),
      );

    expect(nvi).toEqual([null, null, null]);
    expect(movingAverage).toEqual([null, null, null]);
  });

  it('smooths the one-bar percentage change twice for PMO', () => {
    // A steady 1% rise: the smoothed change is 1 and the oscillator 10.
    const values = Array.from({ length: 8 }, (_, index) => 100 * 1.01 ** index);
    const { pmo, signal } = calculateTradingViewNativePriceMomentumOscillator(
      values,
      { firstPeriod: 2, secondPeriod: 2, signalPeriod: 2 },
    );

    expect(getFirstTradingViewNativeFiniteValueIndex(pmo)).toBe(3);
    expect(getFirstTradingViewNativeFiniteValueIndex(signal)).toBe(4);
    expect(pmo[7]).toBeCloseTo(10, 8);
    expect(signal[7]).toBeCloseTo(10, 8);
  });

  it('scales the relative change of the average for the slope', () => {
    // A 1-bar average is the value itself.
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeMaSlope([100, 101, 99.99], { period: 1 }),
      [null, 63.92, -63.92],
    );
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeMaSlope([100, 101, 99.99], {
        lookback: 2,
        period: 1,
      }),
      [null, null, -0.6392],
    );
  });

  it('has no slope against an average of zero', () => {
    expect(calculateTradingViewNativeMaSlope([0, 5], { period: 1 })).toEqual([
      null,
      null,
    ]);
  });
});
