import { getDepthBookPriceStep, getTrueDepthMidPrice } from './perpDepthBook';

describe('the independent depth book target', () => {
  it.each([
    [59_797.5, 5, 1],
    [1679.25, 4, 0.1],
    [68.9055, 2, 0.001],
  ] as const)(
    'derives the full-precision tick for %s',
    (price, szDecimals, step) => {
      expect(getDepthBookPriceStep({ price, szDecimals, isSpot: false })).toBe(
        step,
      );
    },
  );

  it('does not invent a midpoint from a single-sided or crossed quote', () => {
    expect(getTrueDepthMidPrice('99', '101')).toBe(100);
    expect(getTrueDepthMidPrice('99', undefined)).toBeUndefined();
    expect(getTrueDepthMidPrice('101', '99')).toBeUndefined();
  });
});
