import { useEffect } from 'react';

import {
  useAppIsLockedAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { useSettingsLastActivityAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { setIntercomMessengerLocked } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { isNeverLockDuration } from '@onekeyhq/shared/src/utils/passwordUtils';

// The Messenger is presented outside the RN tree, so the lock screen cannot
// cover it; close it on lock and keep in-flight opens from reopening it.
export function useHideIntercomMessengerWhenLocked() {
  const [isLocked] = useAppIsLockedAtom();
  const [{ isPasswordSet, appLockDuration }] = usePasswordPersistAtom();
  const [{ time }] = useSettingsLastActivityAtom();
  const autoLockEnabled =
    isPasswordSet &&
    !isNeverLockDuration(appLockDuration) &&
    travelModeManager.getRuntimeEnvironmentSync().profile.kind !==
      'travel-mode';
  useEffect(() => {
    void setIntercomMessengerLocked(isLocked, {
      autoLockEnabled,
      lockDurationMinutes: appLockDuration,
      lastActivityMs: time,
    }).catch(() => {
      console.warn('Failed to hide Intercom Messenger');
    });
  }, [isLocked, autoLockEnabled, appLockDuration, time]);
}
