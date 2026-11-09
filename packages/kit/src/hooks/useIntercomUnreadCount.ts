import { useSyncExternalStore } from 'react';

import {
  getIntercomUnreadCount,
  subscribeToIntercomUnreadCount,
} from '@onekeyhq/shared/src/modules3rdParty/intercom';

// Bootstrap owns session synchronization; subscribers only read cached state.
export function useIntercomUnreadCount() {
  return useSyncExternalStore(
    subscribeToIntercomUnreadCount,
    getIntercomUnreadCount,
    getIntercomUnreadCount,
  );
}
