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

  it('insets both ends by half the requested gap', () => {
    const noGap = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 25,
      outerRadius: 60,
      innerRadius: 42,
    });
    const withGap = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 25,
      outerRadius: 60,
      innerRadius: 42,
      gapDeg: 4,
    });
    // Gap shortens both ends, so the start x-coord with a 2° inset is > 0
    // (it was exactly 0 without inset — 12 o'clock). A strict inequality
    // guards against the helper silently ignoring gapDeg.
    const firstNumberAfterMove = (path: string) => Number(path.split(' ')[1]);
    expect(firstNumberAfterMove(noGap)).toBe(0);
    expect(firstNumberAfterMove(withGap)).toBeGreaterThan(0);
  });

  it('ignores gapDeg on the full-ring branch', () => {
    const full = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 100,
      outerRadius: 60,
      innerRadius: 42,
      gapDeg: 10,
    });
    // Full ring uses the two-arc trick — largeArc=1 on both outer arcs, no
    // inset applied. Start Move still at (0, -60).
    expect(full.startsWith('M 0 -60')).toBe(true);
    expect((full.match(/A/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
