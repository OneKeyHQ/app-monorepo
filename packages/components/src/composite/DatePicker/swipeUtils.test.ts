import {
  FLICK_VELOCITY_THRESHOLD,
  computeCommitOffsetDate,
  computeSwipeTarget,
} from './swipeUtils';

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

describe('computeCommitOffsetDate', () => {
  const august = new Date(2026, 7, 1);

  it('steps one month forward and backward from the anchor', () => {
    expect(computeCommitOffsetDate({ anchorMonth: august, delta: 1 })).toEqual(
      new Date(2026, 8, 1),
    );
    expect(computeCommitOffsetDate({ anchorMonth: august, delta: -1 })).toEqual(
      new Date(2026, 6, 1),
    );
  });

  it('steps multiple months for queued chained-swipe commits', () => {
    expect(computeCommitOffsetDate({ anchorMonth: august, delta: 2 })).toEqual(
      new Date(2026, 9, 1),
    );
  });

  it('wraps across year boundaries', () => {
    expect(
      computeCommitOffsetDate({
        anchorMonth: new Date(2026, 11, 1),
        delta: 1,
      }),
    ).toEqual(new Date(2027, 0, 1));
    expect(
      computeCommitOffsetDate({
        anchorMonth: new Date(2026, 0, 1),
        delta: -1,
      }),
    ).toEqual(new Date(2025, 11, 1));
  });

  it('normalizes a mid-month anchor to first-of-month steps', () => {
    expect(
      computeCommitOffsetDate({
        anchorMonth: new Date(2026, 7, 31),
        delta: 1,
      }),
    ).toEqual(new Date(2026, 8, 1));
  });

  it('lands on minDate when entering the month that contains it', () => {
    const minDate = new Date(2026, 6, 15);
    expect(
      computeCommitOffsetDate({ anchorMonth: august, delta: -1, minDate }),
    ).toEqual(minDate);
  });

  it('returns null when the target month is entirely before minDate', () => {
    const minDate = new Date(2026, 6, 15);
    expect(
      computeCommitOffsetDate({ anchorMonth: august, delta: -2, minDate }),
    ).toBeNull();
  });

  it('ignores minDate when the target month is fully after it', () => {
    const minDate = new Date(2026, 6, 15);
    expect(
      computeCommitOffsetDate({ anchorMonth: august, delta: 1, minDate }),
    ).toEqual(new Date(2026, 8, 1));
  });
});
