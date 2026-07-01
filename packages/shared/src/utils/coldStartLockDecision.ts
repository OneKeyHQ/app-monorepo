// Pure, platform-independent decision helpers for the low-end-device
// cold-start-lock defer behavior. Kept separate from the `IS_LOW_END_DEVICE`
// constant (see ../performance/deviceMemory) so the logic is unit-testable
// without pulling in any native memory primitive.

// True only when the lock state goes locked -> unlocked, i.e. a real unlock.
// Used to latch "this process has been unlocked once" WITHOUT being fooled by a
// transient/default `isLocked=false` during early state hydration (e.g. the
// first cold start after upgrade, before the persisted password state is read),
// which would otherwise permanently defeat the cold-start defer optimization.
export function isUnlockTransition(
  prevLocked: boolean,
  isLocked: boolean,
): boolean {
  return prevLocked && !isLocked;
}

export function shouldDeferColdStartLockRender({
  isLowEndDevice,
  isLocked,
  hasUnlockedOnce,
}: {
  isLowEndDevice: boolean;
  isLocked: boolean;
  hasUnlockedOnce: boolean;
}): boolean {
  // Only on low-end devices, only while still locked, and only before the very
  // first unlock of this process. After the first unlock we always render the
  // app tree so an auto-lock-while-using never unmounts the user's screen.
  return isLowEndDevice && isLocked && !hasUnlockedOnce;
}
