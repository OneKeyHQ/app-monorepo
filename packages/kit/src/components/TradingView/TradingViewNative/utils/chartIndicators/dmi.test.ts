// cspell:ignore adxr DMI
import { calculateTradingViewNativeDirectionalMovementIndex } from './dmi';
import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative DMI indicator', () => {
  it('calculates all five legacy output series', () => {
    const result = calculateTradingViewNativeDirectionalMovementIndex(
      buildTradingViewNativeIndicatorTestPoints([1, 2, 3, 4]),
      { adxSmoothingPeriod: 2, diPeriod: 2 },
    );

    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.plusDi, [
      null,
      null,
      50,
      50,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.minusDi, [
      null,
      null,
      0,
      0,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.dx, [
      null,
      null,
      100,
      100,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.adx, [
      null,
      null,
      null,
      100,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.adxr, [
      null,
      null,
      null,
      null,
    ]);
  });

  it('uses the legacy 14 / 14 default warm-up boundaries', () => {
    const values = Array.from(
      { length: 41 },
      (_, index) => 100 + index * 0.5 + Math.sin(index * 0.7) * 2,
    );
    const result = calculateTradingViewNativeDirectionalMovementIndex(
      buildTradingViewNativeIndicatorTestPoints(values),
    );

    expect(getFirstTradingViewNativeFiniteValueIndex(result.plusDi)).toBe(14);
    expect(getFirstTradingViewNativeFiniteValueIndex(result.adx)).toBe(27);
    expect(getFirstTradingViewNativeFiniteValueIndex(result.adxr)).toBe(40);
  });

  it('uses zero DX when both directional indices are zero', () => {
    const result = calculateTradingViewNativeDirectionalMovementIndex(
      buildTradingViewNativeIndicatorTestPoints([1, 1, 1, 1]),
      { adxSmoothingPeriod: 2, diPeriod: 2 },
    );

    expect(result.plusDi).toEqual([null, null, 0, 0]);
    expect(result.minusDi).toEqual([null, null, 0, 0]);
    expect(result.dx).toEqual([null, null, 0, 0]);
    expect(result.adx).toEqual([null, null, null, 0]);
  });

  it('calculates finite directional values for tiny non-zero price ranges', () => {
    const points = [1, 2, 3, 4].map((value, index) => {
      const close = value * 1e-11;
      return {
        c: close,
        h: close + 0.5e-11,
        l: close - 0.5e-11,
        o: close,
        t: index,
        v: 10,
      };
    });
    const result = calculateTradingViewNativeDirectionalMovementIndex(points, {
      adxSmoothingPeriod: 2,
      diPeriod: 2,
    });

    expectTradingViewNativeIndicatorValuesToBeCloseTo(result.plusDi, [
      null,
      null,
      66.666_666_666_666_67,
      66.666_666_666_666_67,
    ]);
    expect(result.minusDi).toEqual([null, null, 0, 0]);
    expect(result.dx).toEqual([null, null, 100, 100]);
    expect(result.adx).toEqual([null, null, null, 100]);
  });

  it('does not emit non-finite values after invalid OHLC input', () => {
    const result = calculateTradingViewNativeDirectionalMovementIndex(
      buildTradingViewNativeIndicatorTestPoints([1, Number.NaN, 2]),
    );

    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.plusDi);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.minusDi);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.dx);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.adx);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result.adxr);
  });
});
