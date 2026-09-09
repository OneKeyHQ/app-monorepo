import { normalizeMarketApiKLineInterval } from './marketKLineUtils';

describe('Market K-line utilities', () => {
  it.each([
    ['1m', '1m'],
    ['30s', '30s'],
    ['1h', '1H'],
    ['1d', '1D'],
    ['1w', '1W'],
    ['1M', '1M'],
    [undefined, undefined],
  ])('normalizes API interval %s to %s', (input, expected) => {
    expect(normalizeMarketApiKLineInterval(input)).toBe(expected);
  });
});
