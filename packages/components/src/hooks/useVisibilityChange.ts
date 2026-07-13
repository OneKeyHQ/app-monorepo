import { useEffect } from 'react';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

// Re-exported for backwards compatibility — implementations live in shared/
// so kit-bg and other non-UI layers can subscribe without an illegal import
// up into components.
export { getCurrentVisibilityState, onVisibilityStateChange };

export const useVisibilityChange = (onChange: (visible: boolean) => void) => {
  useEffect(() => {
    const removeSubscription = onVisibilityStateChange(onChange);
    return removeSubscription;
  }, [onChange]);
};
