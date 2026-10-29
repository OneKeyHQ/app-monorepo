import { useSyncExternalStore } from 'react';

import {
  getIntercomUnreadCount,
  subscribeToIntercomUnreadCount,
} from '@onekeyhq/shared/src/modules3rdParty/intercom';

// Session sync is owned by Bootstrap so the SDK stays off the startup path.
export function useIntercomUnreadCountFromSdk() {
  return useSyncExternalStore(
    subscribeToIntercomUnreadCount,
    getIntercomUnreadCount,
    getIntercomUnreadCount,
  );
}
