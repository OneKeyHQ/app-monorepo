import { buildDonutArcPath } from './donutGeometry';

// Centerline radius = (outerRadius + innerRadius) / 2. The stroke-based path
// tracks the middle of the ring (rendered with strokeLinecap="round" for the
// Apple-style look), so all arc commands use this radius rather than outer.
const OUTER = 60;
const INNER = 42;
const CENTER = (OUTER + INNER) / 2; // 51

describe('buildDonutArcPath', () => {
  it('returns an empty string for zero-percent slice', () => {
    expect(
      buildDonutArcPath({
        startPercent: 0,
        sweepPercent: 0,
        outerRadius: OUTER,
        innerRadius: INNER,
      }),
    ).toBe('');
  });

  it('uses two semicircle arcs for a full-ring single slice', () => {
    const d = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 100,
      outerRadius: OUTER,
      innerRadius: INNER,
    });
    // Full ring needs two arc commands to avoid the degenerate start=end
    // endpoint in a single `A` instruction.
    expect((d.match(/A/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('uses largeArc=1 when sweep > 50%', () => {
    const d = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 60,
      outerRadius: OUTER,
      innerRadius: INNER,
    });
    expect(d).toContain(`A ${CENTER} ${CENTER} 0 1 1 `);
  });

  it('uses largeArc=0 when sweep <= 50%', () => {
    const d = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 40,
      outerRadius: OUTER,
      innerRadius: INNER,
    });
    expect(d).toContain(`A ${CENTER} ${CENTER} 0 0 1 `);
  });

  it("starts drawing at 12 o'clock for startPercent=0", () => {
    const d = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 25,
      outerRadius: OUTER,
      innerRadius: INNER,
    });
    expect(d.startsWith(`M 0 -${CENTER}`)).toBe(true);
  });

  it('shrinks the arc when gapPercent is provided', () => {
    const withoutGap = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 50,
      outerRadius: OUTER,
      innerRadius: INNER,
    });
    const withGap = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 50,
      outerRadius: OUTER,
      innerRadius: INNER,
      gapPercent: 1,
    });
    expect(withoutGap).not.toBe(withGap);
  });

  it('clamps gapPercent so tiny slices do not invert', () => {
    const d = buildDonutArcPath({
      startPercent: 0,
      sweepPercent: 0.2,
      outerRadius: OUTER,
      innerRadius: INNER,
      gapPercent: 1, // larger than the slice itself
    });
    expect(d).not.toBe('');
    expect(d.startsWith('M ')).toBe(true);
  });
});
