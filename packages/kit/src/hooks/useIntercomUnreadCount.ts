import { useSyncExternalStore } from 'react';

import {
  getIntercomUnreadCount,
  isIntercomUnreadCountKnown,
  subscribeToIntercomUnreadCount,
} from '@onekeyhq/shared/src/modules3rdParty/intercom';

// Session sync is owned by Bootstrap so the SDK stays off the startup path.
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
