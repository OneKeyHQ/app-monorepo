import { useSyncExternalStore } from 'react';

import {
  getIntercomUnreadCount,
  isIntercomUnreadCountKnown,
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

// Whether the count above has synced at least once this launch.
export function useIsIntercomUnreadCountKnown() {
  return useSyncExternalStore(
    subscribeToIntercomUnreadCount,
    isIntercomUnreadCountKnown,
    isIntercomUnreadCountKnown,
  );
}
