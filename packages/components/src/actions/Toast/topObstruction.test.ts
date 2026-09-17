import {
  TOAST_UNDER_OBSTRUCTION_GAP,
  toastShiftUnderObstruction,
} from './topObstruction';

describe('toastShiftUnderObstruction', () => {
  it('leaves the toaster alone while nothing is up', () => {
    expect(toastShiftUnderObstruction(0, 75)).toBe(0);
  });

  it('rests the first toast a gap under the capsule', () => {
    // An island phone: the capsule hangs at 67 and is 56 tall; the
    // toaster seats its first toast at 59 + 16.
    expect(toastShiftUnderObstruction(123, 75)).toBe(
      123 + TOAST_UNDER_OBSTRUCTION_GAP - 75,
    );
  });

  it('follows a tall card all the way down', () => {
    expect(toastShiftUnderObstruction(587, 75)).toBe(520);
  });

  it('never lifts a toaster that already clears the obstruction', () => {
    expect(toastShiftUnderObstruction(40, 75)).toBe(0);
  });
});
