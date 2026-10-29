import { useEffect, useSyncExternalStore } from 'react';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import {
  getIntercomUnreadCount,
  initIntercom,
  subscribeToIntercomUnreadCount,
} from '@onekeyhq/shared/src/modules3rdParty/intercom';

export function useIntercomUnreadCount() {
  const [{ onekeyUserId, isLoggedIn }] = usePrimePersistAtom();
  useEffect(() => {
    void initIntercom().catch(() => {
      console.warn('Failed to initialize Intercom unread state');
    });
  }, [onekeyUserId, isLoggedIn]);
  return useSyncExternalStore(
    subscribeToIntercomUnreadCount,
    getIntercomUnreadCount,
    getIntercomUnreadCount,
  );
}
