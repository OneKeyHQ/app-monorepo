import { getAppAutoLockDeadline, isAppAutoLockDue } from './passwordUtils';

// The previous checkLockStatus rule, kept to prove the deadline form matches.
function legacyIsDue(now: number, lastActivity: number, duration: number) {
  return (
    now < lastActivity ||
    Math.floor((now - lastActivity) / (1000 * 60)) >= duration
  );
}

describe('app auto-lock rule', () => {
  it('matches whole-minute idle comparison at every boundary', () => {
    const lastActivity = 1_700_000_000_123;
    for (const duration of [0, 1, 5, 30, 60, 120, 240]) {
      const deadline = getAppAutoLockDeadline({
        lastActivity,
        appLockDuration: duration,
      });
      for (const now of [
        lastActivity - 1,
        lastActivity,
        deadline - 1,
        deadline,
        deadline + 1,
      ]) {
        expect(
          isAppAutoLockDue({ now, lastActivity, appLockDuration: duration }),
        ).toBe(legacyIsDue(now, lastActivity, duration));
      }
    }
  });

  it('locks immediately for the always duration and never for the never duration', () => {
    const lastActivity = 1000;
    expect(
      isAppAutoLockDue({ now: lastActivity, lastActivity, appLockDuration: 0 }),
    ).toBe(true);
    expect(
      isAppAutoLockDue({
        now: lastActivity + 10 * 365 * 24 * 3_600_000,
        lastActivity,
        appLockDuration: 100_000_000_000_000,
      }),
    ).toBe(false);
  });
});
