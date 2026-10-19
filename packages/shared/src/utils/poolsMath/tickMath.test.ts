import BigNumber from 'bignumber.js';

import {
  MAX_SQRT_RATIO,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MIN_TICK,
  Q96,
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
} from './tickMath';

const ReferenceBigNumber = BigNumber.clone({
  DECIMAL_PLACES: 100,
  POW_PRECISION: 120,
});

function referenceSqrtRatio(tick: number) {
  return new ReferenceBigNumber('1.0001')
    .pow(tick)
    .sqrt()
    .times(new ReferenceBigNumber(Q96.toString()));
}

describe('getSqrtRatioAtTick', () => {
  it('matches the contract at 0 and at both limits', () => {
    expect(getSqrtRatioAtTick(0)).toBe(Q96);
    expect(getSqrtRatioAtTick(MIN_TICK)).toBe(MIN_SQRT_RATIO);
    expect(getSqrtRatioAtTick(MAX_TICK)).toBe(MAX_SQRT_RATIO);
  });

  it('checks every bit factor against a 100-digit computation', () => {
    for (let bit = 0; bit < 20; bit += 1) {
      for (const sign of [1, -1]) {
        const tick = sign * 2 ** bit;
        const expected = referenceSqrtRatio(tick);
        const actual = new ReferenceBigNumber(
          getSqrtRatioAtTick(tick).toString(),
        );
        // Each of up to 20 Q128.128 steps floors by < 1 unit, so the error is
        // bounded relative to the intermediate ratio, which shrinks as |tick|
        // grows; integer rounding of the result adds ±2.
        const ratioQ128 = new ReferenceBigNumber(2)
          .pow(128)
          .times(new ReferenceBigNumber('1.0001').pow(-Math.abs(tick)).sqrt());
        const tolerance = ReferenceBigNumber.max(
          2,
          expected.times(
            new ReferenceBigNumber(32).div(ratioQ128).plus('1e-30'),
          ),
        );
        expect(actual.minus(expected).abs().lte(tolerance)).toBe(true);
      }
    }
  });

  it('rejects ticks outside the range', () => {
    expect(() => getSqrtRatioAtTick(MAX_TICK + 1)).toThrow();
    expect(() => getSqrtRatioAtTick(MIN_TICK - 1)).toThrow();
    expect(() => getSqrtRatioAtTick(1.5)).toThrow();
  });
});

describe('getTickAtSqrtRatio', () => {
  it('returns the limits', () => {
    expect(getTickAtSqrtRatio(MIN_SQRT_RATIO)).toBe(MIN_TICK);
    expect(getTickAtSqrtRatio(MAX_SQRT_RATIO - BigInt(1))).toBe(MAX_TICK - 1);
  });

  it('returns the greatest tick at or below the ratio', () => {
    for (const tick of [-200_000, -60, -1, 0, 1, 59, 60, 195_004, 600_000]) {
      const ratio = getSqrtRatioAtTick(tick);
      expect(getTickAtSqrtRatio(ratio)).toBe(tick);
      expect(getTickAtSqrtRatio(ratio - BigInt(1))).toBe(tick - 1);
    }
  });
});
