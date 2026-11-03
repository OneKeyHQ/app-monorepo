import memoize from 'memoizee';

import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';

export const isNeverLockDuration = memoize((appLockDuration: number) => {
  return String(appLockDuration) === ELockDuration.Never;
});

// Auto-lock rule shared by checkLockStatus and the Android Messenger guard:
// lock once the deadline passes, or when the clock moved before the last
// activity. Matches whole elapsed minutes reaching appLockDuration.
export function getAppAutoLockDeadline({
  lastActivity,
  appLockDuration,
}: {
  lastActivity: number;
  appLockDuration: number;
}) {
  return lastActivity + Math.ceil(appLockDuration) * 60_000;
}

export function isAppAutoLockDue({
  now,
  lastActivity,
  appLockDuration,
}: {
  now: number;
  lastActivity: number;
  appLockDuration: number;
}) {
  return (
    now < lastActivity ||
    now >= getAppAutoLockDeadline({ lastActivity, appLockDuration })
  );
}
