import { formatLightweightMarketValue } from './lightweightCells';

describe('formatLightweightMarketValue', () => {
  test.each<[unknown, string]>([
    [undefined, '--'],
    [null, '--'],
    ['', '--'],
    [Number.NaN, '--'],
    ['abc', 'abc'],
    [1_500_000_000, '1.5B'],
    [25_000_000_000, '25B'],
    [12_000_000, '12M'],
    [1_500_000, '1.5M'],
    [1500, '1.5K'],
    [0.005, '0.00500'],
    [42, '42'],
    [123.456, '123.5'],
    // `Math.PI` stands in for a spelled-out 3.14159, which the linter reads as
    // a stray approximation of it.
    [Math.PI, '3.14'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatLightweightMarketValue(input)).toBe(expected);
  });
});
