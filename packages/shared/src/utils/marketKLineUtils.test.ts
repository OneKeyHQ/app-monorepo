import {
  fillMarketKLineGaps,
  getMarketApiKLineIntervalSeconds,
  normalizeMarketApiKLineInterval,
} from './marketKLineUtils';

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

describe('getMarketApiKLineIntervalSeconds', () => {
  it.each([
    ['5m', 300],
    ['1m', 60],
    ['30s', 30],
    ['1H', 3600],
    ['4H', 14_400],
    ['1D', 86_400],
    ['1W', 604_800],
  ])('reads %s as %s seconds', (input, expected) => {
    expect(getMarketApiKLineIntervalSeconds(input)).toBe(expected);
  });

  it.each([[undefined], [''], ['1M'], ['abc'], ['0m'], ['-5m']])(
    'returns undefined for %s',
    (input) => {
      expect(getMarketApiKLineIntervalSeconds(input)).toBeUndefined();
    },
  );
});

describe('fillMarketKLineGaps', () => {
  const t0 = 1_788_000_000;

  it('carries the last close across skipped buckets', () => {
    expect(
      fillMarketKLineGaps(
        [
          [t0, 10],
          [t0 + 900, 12],
          [t0 + 1200, 11],
        ],
        300,
      ),
    ).toEqual([
      [t0, 10],
      [t0 + 300, 10],
      [t0 + 600, 10],
      [t0 + 900, 12],
      [t0 + 1200, 11],
    ]);
  });

  it('leaves an already continuous series untouched', () => {
    const points: [number, number][] = [
      [t0, 10],
      [t0 + 300, 11],
      [t0 + 600, 12],
    ];
    expect(fillMarketKLineGaps(points, 300)).toBe(points);
  });

  it('never extrapolates past the ends', () => {
    const filled = fillMarketKLineGaps(
      [
        [t0, 10],
        [t0 + 600, 11],
      ],
      300,
    );
    expect(filled[0]).toEqual([t0, 10]);
    expect(filled.at(-1)).toEqual([t0 + 600, 11]);
  });

  it('leaves a feed denser than the grid alone rather than re-bucketing', () => {
    const points: [number, number][] = [
      [t0, 10],
      [t0 + 60, 10.5],
      [t0 + 120, 10.9],
      [t0 + 600, 12],
    ];
    expect(fillMarketKLineGaps(points, 300)).toBe(points);
  });

  it('gives up rather than expanding a pathological gap', () => {
    const points: [number, number][] = [
      [t0, 10],
      [t0 + 30 * 24 * 60 * 60, 11],
    ];
    expect(fillMarketKLineGaps(points, 60)).toBe(points);
  });

  it('returns the input when the interval is unknown', () => {
    const points: [number, number][] = [
      [t0, 10],
      [t0 + 900, 11],
    ];
    expect(fillMarketKLineGaps(points, undefined)).toBe(points);
  });
});
