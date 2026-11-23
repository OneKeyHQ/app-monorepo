import {
  appIsLocked,
  passwordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { settingsLastActivityAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import {
  getAppAutoLockDeadline,
  isNeverLockDuration,
} from '@onekeyhq/shared/src/utils/passwordUtils';

let ready = false;

export async function markIntercomLockReady() {
  await Promise.all([
    appIsLocked.ready(),
    passwordPersistAtom.ready(),
    settingsLastActivityAtom.ready(),
  ]);
  ready = true;
}

export function isIntercomLocked() {
  // Native/extension main initializes independently of bg. The lock boundary
  // must mount before support can use its synchronized atoms.
  if (!ready || jotaiDefaultStore.get(appIsLocked.atom())) return true;
  const { isPasswordSet, appLockDuration } = jotaiDefaultStore.get(
    passwordPersistAtom.atom(),
  );
  if (
    !isPasswordSet ||
    isNeverLockDuration(appLockDuration) ||
    travelModeManager.getRuntimeEnvironmentSync().profile.kind === 'travel-mode'
  )
    return false;
  const { time } = jotaiDefaultStore.get(settingsLastActivityAtom.atom());
  const now = Date.now();
  // Enforce the deadline even before a resumed main runtime renders its lock UI.
  return (
    now < time ||
    now >= getAppAutoLockDeadline({ lastActivity: time, appLockDuration })
  );
}
