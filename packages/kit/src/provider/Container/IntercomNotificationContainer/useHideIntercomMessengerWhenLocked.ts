import { useEffect } from 'react';

import {
  useAppIsLockedAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { useSettingsLastActivityAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { setIntercomMessengerLocked } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import {
  getAppAutoLockDeadline,
  isNeverLockDuration,
} from '@onekeyhq/shared/src/utils/passwordUtils';

// Cancel support requests on lock and reject operations past the auto-lock
// deadline, including when the main runtime resumes before the lock UI updates.
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
    // Without auto-lock the window never closes, even on clock rollback.
    const policy = autoLockEnabled
      ? {
          validFromMs: time,
          lockAtMs: getAppAutoLockDeadline({
            lastActivity: time,
            appLockDuration,
          }),
        }
      : { validFromMs: 0, lockAtMs: Number.MAX_VALUE };
    void setIntercomMessengerLocked(isLocked, policy).catch(() => {
      console.warn('Failed to hide Intercom Messenger');
    });
  }, [isLocked, autoLockEnabled, appLockDuration, time]);
}
