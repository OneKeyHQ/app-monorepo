import { useEffect } from 'react';

import { overlayStore } from '@onekeyfe/react-native-native-overlay';

/**
 * While the app is locked, overlays below the `lock` level are closed and
 * refused. The lock screen still lives in the app window, below the native
 * overlay windows, so nothing above it may stay visible.
 */
export function useOverlaySecurityBlocked(blocked: boolean) {
  useEffect(() => {
    overlayStore.setSecurityBlocked(blocked);
    return () => overlayStore.setSecurityBlocked(false);
  }, [blocked]);
}
