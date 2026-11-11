import { useLayoutEffect } from 'react';

import { syncIntercomLockState } from '@onekeyhq/kit/src/views/Intercom/client';
import {
  useAppIsLockedAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { useSettingsLastActivityAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
// Cancel support requests on lock and reject operations past the auto-lock
// deadline, including when the main runtime resumes before the lock UI updates.
export function useHideIntercomMessengerWhenLocked() {
  const [isLocked] = useAppIsLockedAtom();
  const [{ isPasswordSet, appLockDuration }] = usePasswordPersistAtom();
  const [{ time }] = useSettingsLastActivityAtom();
  useLayoutEffect(() => {
    void syncIntercomLockState().catch(() => {
      console.warn('Failed to synchronize support lock state');
    });
  }, [isLocked, isPasswordSet, appLockDuration, time]);
}
