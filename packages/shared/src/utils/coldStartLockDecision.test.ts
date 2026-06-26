import {
  isUnlockTransition,
  shouldDeferColdStartLockRender,
} from './coldStartLockDecision';

describe('isUnlockTransition', () => {
  it('latches only on a real locked -> unlocked transition', () => {
    expect(isUnlockTransition(true, false)).toBe(true);
  });

  it('does NOT latch on a transient/default `false` (e.g. early hydration before locked is known)', () => {
    expect(isUnlockTransition(false, false)).toBe(false);
  });

  it('does NOT latch while staying locked', () => {
    expect(isUnlockTransition(true, true)).toBe(false);
  });

  it('does NOT latch on a unlocked -> locked (auto-lock) transition', () => {
    expect(isUnlockTransition(false, true)).toBe(false);
  });
});

describe('shouldDeferColdStartLockRender', () => {
  it('defers children on a low-end device that is locked and never unlocked', () => {
    expect(
      shouldDeferColdStartLockRender({
        isLowEndDevice: true,
        isLocked: true,
        hasUnlockedOnce: false,
      }),
    ).toBe(true);
  });

  it('does NOT defer after the first unlock even if re-locked (auto-lock preserves children)', () => {
    expect(
      shouldDeferColdStartLockRender({
        isLowEndDevice: true,
        isLocked: true,
        hasUnlockedOnce: true,
      }),
    ).toBe(false);
  });

  it('does NOT defer on a non-low-end device', () => {
    expect(
      shouldDeferColdStartLockRender({
        isLowEndDevice: false,
        isLocked: true,
        hasUnlockedOnce: false,
      }),
    ).toBe(false);
  });

  it('does NOT defer when the app is unlocked', () => {
    expect(
      shouldDeferColdStartLockRender({
        isLowEndDevice: true,
        isLocked: false,
        hasUnlockedOnce: false,
      }),
    ).toBe(false);
  });
});
