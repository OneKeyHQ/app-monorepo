import { useSyncExternalStore } from 'react';

import {
  getIntercomUnreadCount,
  subscribeToIntercomUnreadCount,
} from '@onekeyhq/kit/src/views/Intercom/client';

// Bootstrap owns session synchronization; subscribers only read cached state.
export function useIntercomUnreadCount() {
  return useSyncExternalStore(
    subscribeToIntercomUnreadCount,
    getIntercomUnreadCount,
    getIntercomUnreadCount,
  );
}
