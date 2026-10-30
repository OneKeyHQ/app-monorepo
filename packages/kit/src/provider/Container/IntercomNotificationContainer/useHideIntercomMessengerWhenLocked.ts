import { useEffect } from 'react';

import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { setIntercomMessengerLocked } from '@onekeyhq/shared/src/modules3rdParty/intercom';

// The Messenger is presented outside the RN tree, so the lock screen cannot
// cover it; close it on lock and keep in-flight opens from reopening it.
export function useHideIntercomMessengerWhenLocked() {
  const [isLocked] = useAppIsLockedAtom();
  useEffect(() => {
    void setIntercomMessengerLocked(isLocked).catch(() => {
      console.warn('Failed to hide Intercom Messenger');
    });
  }, [isLocked]);
}
