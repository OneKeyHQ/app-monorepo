import { buildDonutArcPath } from './donutGeometry';

describe('buildDonutArcPath', () => {
  it('returns an empty string for zero-percent slice', () => {
    expect(
      buildDonutArcPath({
        startPercent: 0,
        sweepPercent: 0,
        outerRadius: 60,
        innerRadius: 42,
      }),
    ).toBe('');
  });

  it('uses two semicircle arcs for a full-ring single slice', () => {
    const d = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 100,
      outerRadius: 60,
      innerRadius: 42,
    });
    // Two "A" arc commands are required to draw a full ring without a
    // degenerate start=end endpoint.
    expect((d.match(/A/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(d.trim().endsWith('Z')).toBe(true);
  });

  it('uses largeArc=1 when sweep > 50%', () => {
    const d = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 60,
      outerRadius: 60,
      innerRadius: 42,
    });
    // First arc command should have "1 1" for large-arc + sweep-flag.
    expect(d).toMatch(/A 60 60 0 1 1 /);
  });

  it('uses largeArc=0 when sweep <= 50%', () => {
    const d = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 40,
      outerRadius: 60,
      innerRadius: 42,
    });
    expect(d).toMatch(/A 60 60 0 0 1 /);
  });

  it("starts drawing at 12 o'clock for startPercent=0", () => {
    const d = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 25,
      outerRadius: 60,
      innerRadius: 42,
    });
    // First Move command lands on (0, -60) relative to centre.
    expect(d.startsWith('M 0 -60')).toBe(true);
  });
});
