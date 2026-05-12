import { interpolateHeight } from '../interpolateHeight';

describe('interpolateHeight', () => {
  it('returns the measured height at integer progress', () => {
    expect(
      interpolateHeight({ progress: 0, heights: [100, 200, 150], fallback: 0 }),
    ).toBe(100);
    expect(
      interpolateHeight({ progress: 1, heights: [100, 200, 150], fallback: 0 }),
    ).toBe(200);
    expect(
      interpolateHeight({ progress: 2, heights: [100, 200, 150], fallback: 0 }),
    ).toBe(150);
  });

  it('linearly interpolates between adjacent heights', () => {
    expect(
      interpolateHeight({
        progress: 0.5,
        heights: [100, 200, 150],
        fallback: 0,
      }),
    ).toBe(150);
    expect(
      interpolateHeight({
        progress: 1.25,
        heights: [100, 200, 150],
        fallback: 0,
      }),
    ).toBe(187.5);
  });

  it('uses fallback for unmeasured slides', () => {
    expect(
      interpolateHeight({ progress: 0, heights: [0, 200, 150], fallback: 80 }),
    ).toBe(80);
    expect(
      interpolateHeight({
        progress: 0.5,
        heights: [0, 200, 150],
        fallback: 80,
      }),
    ).toBe(140); // (80 + 200) / 2
  });

  it('clamps progress to valid range', () => {
    expect(
      interpolateHeight({ progress: -1, heights: [100, 200], fallback: 0 }),
    ).toBe(100);
    expect(
      interpolateHeight({ progress: 5, heights: [100, 200], fallback: 0 }),
    ).toBe(200);
  });

  it('returns fallback for empty heights array', () => {
    expect(interpolateHeight({ progress: 0, heights: [], fallback: 80 })).toBe(
      80,
    );
  });
});
