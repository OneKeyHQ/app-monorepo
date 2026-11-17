import { calculateTradingViewNativeEnvelope } from './envelope';
import {
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative Envelope indicator', () => {
  it('needs a full kernel window plus a full deviation window', () => {
    const values = Array.from({ length: 12 }, () => 5);
    const { lower, upper } = calculateTradingViewNativeEnvelope(values, {
      lookback: 4,
    });

    // 3 bars before the first centre, then 2 more before the first band.
    expect(getFirstTradingViewNativeFiniteValueIndex(upper)).toBe(5);
    expect(getFirstTradingViewNativeFiniteValueIndex(lower)).toBe(5);
    expect(upper[11]).toBeCloseTo(5, 10);
    expect(lower[11]).toBeCloseTo(5, 10);
  });

  it('centres on the latest value when the bandwidth is zero', () => {
    const { lower, upper } = calculateTradingViewNativeEnvelope(
      [1, 2, 3, 4, 5, 6],
      { bandwidth: 0, lookback: 3, multiplier: 2 },
    );

    expectTradingViewNativeIndicatorValuesToBeCloseTo(upper, [
      null,
      null,
      null,
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
