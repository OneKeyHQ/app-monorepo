import { computeTargetIndex } from '../computeTargetIndex';

const FLICK_VELOCITY = 500; // px/s — same threshold the gesture worklet will use

describe('computeTargetIndex', () => {
  it('rounds to nearest integer when velocity is below flick threshold', () => {
    expect(computeTargetIndex({ progress: 0.4, velocityX: 0, count: 3 })).toBe(
      0,
    );
    expect(computeTargetIndex({ progress: 0.6, velocityX: 0, count: 3 })).toBe(
      1,
    );
    expect(
      computeTargetIndex({ progress: 1.49, velocityX: -100, count: 3 }),
    ).toBe(1);
  });

  it('flicks forward when velocity exceeds threshold and direction is forward', () => {
    expect(
      computeTargetIndex({
        progress: 0.1,
        velocityX: -(FLICK_VELOCITY + 1),
        count: 3,
      }),
    ).toBe(1);
  });

  it('flicks backward when velocity exceeds threshold and direction is backward', () => {
    expect(
      computeTargetIndex({
        progress: 1.9,
        velocityX: FLICK_VELOCITY + 1,
        count: 3,
      }),
    ).toBe(1);
  });

  it('clamps to bounds at first slide', () => {
    expect(
      computeTargetIndex({
        progress: 0.1,
        velocityX: FLICK_VELOCITY + 1,
        count: 3,
      }),
    ).toBe(0);
    expect(computeTargetIndex({ progress: -0.5, velocityX: 0, count: 3 })).toBe(
      0,
    );
  });

  it('clamps to bounds at last slide', () => {
    expect(
      computeTargetIndex({
        progress: 1.9,
        velocityX: -(FLICK_VELOCITY + 1),
        count: 3,
      }),
    ).toBe(2);
    expect(computeTargetIndex({ progress: 2.5, velocityX: 0, count: 3 })).toBe(
      2,
    );
  });

  it('does not flick when velocity is exactly at threshold', () => {
    expect(
      computeTargetIndex({
        progress: 0.4,
        velocityX: -FLICK_VELOCITY,
        count: 3,
      }),
    ).toBe(0);
  });
});
