import { calculateTradingViewNativeEnvelope } from './envelope';
import {
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative Envelope indicator', () => {
  it('shows a band on a 100-candle history with the default settings', () => {
    // 100 candles is what a stock chart loads first.
    const values = Array.from(
      { length: 100 },
      (_, index) => 100 + Math.sin(index / 5) * 10,
    );
    const { lower, upper } = calculateTradingViewNativeEnvelope(values);

    // The band starts once the history covers three bandwidths of 8.
    expect(getFirstTradingViewNativeFiniteValueIndex(upper)).toBe(23);
    expect(getFirstTradingViewNativeFiniteValueIndex(lower)).toBe(23);
    expect(upper.slice(23).every((value) => value !== null)).toBe(true);
    expect(upper[99]).toBeGreaterThan(values[99] ?? 0);
    expect(lower[99]).toBeLessThan(values[99] ?? 0);
  });

  it('never waits longer than the lookback before it starts', () => {
    const values = Array.from({ length: 12 }, () => 5);
    const { lower, upper } = calculateTradingViewNativeEnvelope(values, {
      lookback: 4,
    });

    expect(getFirstTradingViewNativeFiniteValueIndex(upper)).toBe(3);
    expect(getFirstTradingViewNativeFiniteValueIndex(lower)).toBe(3);
    expect(upper[11]).toBeCloseTo(5, 10);
    expect(lower[11]).toBeCloseTo(5, 10);
  });

  it('uses the full windows once the history is long enough', () => {
    const bandwidth = 2;
    const lookback = 6;
    const multiplier = 1.5;
    const values = Array.from(
      { length: 30 },
      (_, index) => 100 + Math.sin(index / 2) * 10 + index,
    );
    const { lower, upper } = calculateTradingViewNativeEnvelope(values, {
      bandwidth,
      lookback,
      multiplier,
    });
    const weights = Array.from({ length: lookback }, (_, offset) =>
      Math.exp(-(offset * offset) / (2 * bandwidth * bandwidth)),
    );
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const getCentre = (endIndex: number) =>
      weights.reduce(
        (sum, weight, offset) =>
          sum + (values[endIndex - offset] ?? 0) * weight,
        0,
      ) / weightSum;
    const getWidth = (endIndex: number) => {
      let distanceSum = 0;
      for (
        let index = endIndex - (lookback - 2);
        index <= endIndex;
        index += 1
      ) {
        distanceSum += Math.abs((values[index] ?? 0) - getCentre(index));
      }
      return (multiplier * distanceSum) / (lookback - 1);
    };

    // Bar 2 * lookback - 3 is the first one with both windows full.
    for (let index = 2 * lookback - 3; index < values.length; index += 1) {
      expect(upper[index]).toBeCloseTo(getCentre(index) + getWidth(index), 9);
      expect(lower[index]).toBeCloseTo(getCentre(index) - getWidth(index), 9);
    }
  });

  it('centres on the latest value when the bandwidth is zero', () => {
    const { lower, upper } = calculateTradingViewNativeEnvelope(
      [1, 2, 3, 4, 5, 6],
      { bandwidth: 0, lookback: 3, multiplier: 2 },
    );

    expectTradingViewNativeIndicatorValuesToBeCloseTo(upper, [
      null,
      2,
      3,
      4,
      5,
      6,
    ]);
    expect(lower).toEqual(upper);
  });

  it('keeps the bands symmetric and scaled by the multiplier', () => {
    const values = Array.from(
      { length: 40 },
      (_, index) => 100 + Math.sin(index / 2) * 10,
    );
    const narrow = calculateTradingViewNativeEnvelope(values, {
      bandwidth: 2,
      lookback: 8,
      multiplier: 1,
    });
    const wide = calculateTradingViewNativeEnvelope(values, {
      bandwidth: 2,
      lookback: 8,
      multiplier: 3,
    });
    const last = values.length - 1;
    const centre = ((narrow.upper[last] ?? 0) + (narrow.lower[last] ?? 0)) / 2;

    expect(((wide.upper[last] ?? 0) + (wide.lower[last] ?? 0)) / 2).toBeCloseTo(
      centre,
      10,
    );
    expect((wide.upper[last] ?? 0) - centre).toBeCloseTo(
      3 * ((narrow.upper[last] ?? 0) - centre),
      10,
    );
  });

  it('never changes earlier bars when a new bar arrives', () => {
    const values = Array.from(
      { length: 30 },
      (_, index) => 50 + Math.cos(index / 3) * 4,
    );
    const options = { bandwidth: 2, lookback: 6 };
    const before = calculateTradingViewNativeEnvelope(values, options);
    const after = calculateTradingViewNativeEnvelope([...values, 80], options);

    expect(after.upper.slice(0, values.length)).toEqual(before.upper);
    expect(after.lower.slice(0, values.length)).toEqual(before.lower);
  });
});
