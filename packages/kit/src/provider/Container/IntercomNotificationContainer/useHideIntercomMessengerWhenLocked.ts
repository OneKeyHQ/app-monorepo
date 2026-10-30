import { useEffect } from 'react';

import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { hideIntercomMessenger } from '@onekeyhq/shared/src/modules3rdParty/intercom';

// The Messenger is presented outside the RN tree, so the lock screen cannot
// cover it; close it whenever the wallet locks.
export function useHideIntercomMessengerWhenLocked() {
  const [isLocked] = useAppIsLockedAtom();
  useEffect(() => {
    if (isLocked) {
      void hideIntercomMessenger().catch(() => {
        console.warn('Failed to hide Intercom Messenger');
      });
    }
  }, [isLocked]);
}
