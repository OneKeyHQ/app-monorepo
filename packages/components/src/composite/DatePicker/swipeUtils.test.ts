import { FLICK_VELOCITY_THRESHOLD, computeSwipeTarget } from './swipeUtils';

describe('computeSwipeTarget', () => {
  const base = { minIndex: 4, maxIndex: 6 };
  const wide = { minIndex: 0, maxIndex: 10 };

  it('snaps to the nearest page on slow release', () => {
    expect(computeSwipeTarget({ progress: 5.6, velocityX: 0, ...base })).toBe(
      6,
    );
    expect(computeSwipeTarget({ progress: 5.4, velocityX: 0, ...base })).toBe(
      5,
    );
  });

  it('slow release below the flick threshold still snaps, not flicks', () => {
    expect(
      computeSwipeTarget({
        progress: 5.3,
        velocityX: FLICK_VELOCITY_THRESHOLD - 1,
        ...base,
      }),
    ).toBe(5);
    expect(
      computeSwipeTarget({
        progress: 5.3,
        velocityX: -(FLICK_VELOCITY_THRESHOLD - 1),
        ...base,
      }),
    ).toBe(5);
  });

  it('velocity exactly at the threshold snaps instead of flicking', () => {
    expect(
      computeSwipeTarget({
        progress: 5.3,
        velocityX: -FLICK_VELOCITY_THRESHOLD,
        ...base,
      }),
    ).toBe(5);
    expect(
      computeSwipeTarget({
        progress: 5.3,
        velocityX: FLICK_VELOCITY_THRESHOLD,
        ...base,
      }),
    ).toBe(5);
  });

  it('advances one page on a fast leftward flick (towards next month)', () => {
    expect(
      computeSwipeTarget({ progress: 5.1, velocityX: -800, ...wide }),
    ).toBe(6);
  });

  it('goes back one page on a fast rightward flick (towards previous month)', () => {
    expect(computeSwipeTarget({ progress: 4.9, velocityX: 800, ...wide })).toBe(
      4,
    );
  });

  it('a flick never skips more than one page', () => {
    expect(computeSwipeTarget({ progress: 5, velocityX: -9000, ...wide })).toBe(
      6,
    );
    expect(computeSwipeTarget({ progress: 5, velocityX: 9000, ...wide })).toBe(
      4,
    );
  });

  it('clamps to maxIndex when the next month is out of range', () => {
    expect(
      computeSwipeTarget({
        progress: 0.6,
        velocityX: -800,
        minIndex: -1,
        maxIndex: 0,
      }),
    ).toBe(0);
  });

  it('clamps to minIndex when the previous month is out of range', () => {
    expect(
      computeSwipeTarget({
        progress: -0.6,
        velocityX: 800,
        minIndex: 0,
        maxIndex: 1,
      }),
    ).toBe(0);
  });
});
