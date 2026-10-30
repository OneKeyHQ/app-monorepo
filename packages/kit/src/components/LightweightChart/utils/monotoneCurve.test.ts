import {
  buildMonotoneCurveSegments,
  sampleMonotoneCurve,
} from './monotoneCurve';

describe('monotoneCurve', () => {
  it('returns no segments for fewer than two points', () => {
    expect(buildMonotoneCurveSegments([])).toEqual([]);
    expect(buildMonotoneCurveSegments([{ x: 0, y: 1 }])).toEqual([]);
  });

  it('keeps a two-point curve straight', () => {
    expect(
      buildMonotoneCurveSegments([
        { x: 0, y: 0 },
        { x: 3, y: 6 },
      ]),
    ).toEqual([{ cp1x: 1, cp1y: 2, cp2x: 2, cp2y: 4, x: 3, y: 6 }]);
  });

  it('flattens the tangent at a local extreme', () => {
    const [first, second] = buildMonotoneCurveSegments([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
    ]);
    expect(first.cp2y).toBe(0);
    expect(second.cp1y).toBe(0);
  });

  it('passes through every input point', () => {
    const points = [
      { x: 0, y: 5 },
      { x: 4, y: 9 },
      { x: 9, y: 2 },
      { x: 15, y: 3 },
      { x: 20, y: 8 },
    ];
    const sampled = sampleMonotoneCurve(points);
    points.forEach((point) => {
      expect(sampled).toContainEqual(point);
    });
    expect(sampled[0]).toEqual(points[0]);
    expect(sampled.at(-1)).toEqual(points.at(-1));
  });

  it('never leaves the range between neighboring points', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return seed / 2_147_483_647;
    };
    const points = Array.from({ length: 200 }, (_, index) => ({
      x: index * (1 + random() * 5),
      y: random() * 100,
    })).toSorted((a, b) => a.x - b.x);
    const sampled = sampleMonotoneCurve(points, 0.25);
    let segment = 0;
    sampled.forEach((point) => {
      while (point.x > points[segment + 1].x) segment += 1;
      const low = Math.min(points[segment].y, points[segment + 1].y);
      const high = Math.max(points[segment].y, points[segment + 1].y);
      expect(point.y).toBeGreaterThanOrEqual(low - 1e-9);
      expect(point.y).toBeLessThanOrEqual(high + 1e-9);
    });
  });

  it('does not divide by zero on repeated x', () => {
    const sampled = sampleMonotoneCurve([
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 5, y: 3 },
    ]);
    sampled.forEach((point) => {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
    });
  });
});
