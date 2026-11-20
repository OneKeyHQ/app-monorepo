// cspell:ignore KDJ SKDJ
import {
  calculateTradingViewNativeKdj,
  calculateTradingViewNativeRawStochastic,
  calculateTradingViewNativeSkdj,
} from './kdj';
import { expectTradingViewNativeIndicatorValuesToBeCloseTo } from './testUtils';

describe('TradingViewNative KDJ and SKDJ indicators', () => {
  const points = [
    { c: 5, h: 10, l: 0, o: 5, t: 1, v: 1 },
    { c: 20, h: 20, l: 10, o: 5, t: 2, v: 1 },
    { c: 10, h: 20, l: 10, o: 20, t: 3, v: 1 },
  ];

  it('places the close inside the range of the latest bars', () => {
    expect(calculateTradingViewNativeRawStochastic(points, 2)).toEqual([
      null,
      100,
      0,
    ]);
  });

  it('repeats the previous raw value while the range is flat', () => {
    const flatPoints = [
      { c: 5, h: 5, l: 5, o: 5, t: 1, v: 1 },
      { c: 5, h: 5, l: 5, o: 5, t: 2, v: 1 },
      { c: 8, h: 9, l: 5, o: 5, t: 3, v: 1 },
      { c: 9, h: 9, l: 9, o: 9, t: 4, v: 1 },
    ];

    expect(calculateTradingViewNativeRawStochastic(flatPoints, 1)).toEqual([
      50, 50, 75, 75,
    ]);
  });

  it('smooths K and D from 50 and derives J from them', () => {
    const { d, j, k } = calculateTradingViewNativeKdj(points, {
      dPeriod: 3,
      kPeriod: 3,
      period: 2,
    });
    const firstK = (100 + 2 * 50) / 3;
    const firstD = (firstK + 2 * 50) / 3;
    const secondK = (2 * firstK) / 3;
    const secondD = (secondK + 2 * firstD) / 3;

    expectTradingViewNativeIndicatorValuesToBeCloseTo(k, [
      null,
      firstK,
      secondK,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(d, [
      null,
      firstD,
      secondD,
    ]);
    expectTradingViewNativeIndicatorValuesToBeCloseTo(j, [
      null,
      3 * firstK - 2 * firstD,
      3 * secondK - 2 * secondD,
    ]);
  });

  it('follows the raw value when the smoothing lengths are one', () => {
    const kdj = calculateTradingViewNativeKdj(points, {
      dPeriod: 1,
      kPeriod: 1,
      period: 2,
    });
    const skdj = calculateTradingViewNativeSkdj(points, {
      period: 2,
      smoothingPeriod: 1,
    });

    expect(kdj.k).toEqual([null, 100, 0]);
    expect(kdj.j).toEqual([null, 100, 0]);
    expect(skdj.k).toEqual([null, 100, 0]);
    expect(skdj.d).toEqual([null, 100, 0]);
  });

  it('averages the twice smoothed slow K for the slow D', () => {
    const closes = [5, 20, 10, 18, 12, 16, 14, 15];
    const slowPoints = closes.map((close, index) => ({
      c: close,
      h: close + 2,
      l: close - 2,
      o: close,
      t: index,
      v: 1,
    }));
    const { d, k } = calculateTradingViewNativeSkdj(slowPoints, {
      period: 2,
      smoothingPeriod: 2,
    });

    // Raw from bar 1, two 2-bar exponential averages, then a 2-bar average.
    expect(k.findIndex((value) => value !== null)).toBe(3);
    expect(d.findIndex((value) => value !== null)).toBe(4);
    expect(d[5]).toBeCloseTo(((k[4] ?? 0) + (k[5] ?? 0)) / 2, 10);
  });
});
