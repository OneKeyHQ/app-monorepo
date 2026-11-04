import { buildSecondaryLineSeries } from './useChartConfig';

describe('buildSecondaryLineSeries', () => {
  it('hides the segment that would bridge a gap', () => {
    // lightweight-charts joins point 2 to point 4 across the whitespace point
    // and strokes that segment in point 2's color, so point 2 is transparent;
    // the segment 1 -> 2 keeps the series color, being drawn in point 1's.
    const { line } = buildSecondaryLineSeries([
      [1, 20],
      [2, 20],
      [3, null],
      [4, 19],
      [5, 19],
    ]);

    expect(line).toEqual([
      { time: 1, value: 20 },
      { time: 2, value: 20, color: 'transparent' },
      { time: 3 },
      { time: 4, value: 19 },
      { time: 5, value: 19 },
    ]);
  });

  it('leaves a series without gaps in the series color', () => {
    expect(
      buildSecondaryLineSeries([
        [1, 3],
        [2, 4],
        [3, null],
      ]).line,
    ).toEqual([
      { time: 1, value: 3 },
      { time: 2, value: 4, color: 'transparent' },
      { time: 3 },
    ]);
    expect(
      buildSecondaryLineSeries([
        [1, 3],
        [2, 4],
      ]).line,
    ).toEqual([
      { time: 1, value: 3 },
      { time: 2, value: 4 },
    ]);
  });

  it('returns the points no segment can reach as dots', () => {
    // The first hour of a new campaign run has a gap before it and nothing
    // after it, so the line series alone would draw nothing for it.
    const { isolatedPoints } = buildSecondaryLineSeries([
      [1, 20],
      [2, null],
      [3, 18],
      [4, null],
      [5, 19],
      [6, 19],
      [7, null],
      [8, 19.57],
    ]);

    expect(isolatedPoints).toEqual([
      { time: 1, value: 20 },
      { time: 3, value: 18 },
      { time: 8, value: 19.57 },
    ]);
  });

  it('treats a single point as isolated and a plain series as connected', () => {
    expect(buildSecondaryLineSeries([[1, 3]]).isolatedPoints).toEqual([
      { time: 1, value: 3 },
    ]);
    expect(
      buildSecondaryLineSeries([
        [1, 3],
        [2, 4],
      ]).isolatedPoints,
    ).toEqual([]);
    expect(buildSecondaryLineSeries(undefined)).toEqual({
      line: undefined,
      isolatedPoints: undefined,
    });
  });
});
