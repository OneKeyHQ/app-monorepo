import { useEffect, useState } from 'react';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';

export function useEarnAvailableAssetsVisibilityGate() {
  const isFocused = useRouteIsFocused();
  const [isVisible, setIsVisible] = useState(() => getCurrentVisibilityState());

  useEffect(() => {
    const handleVisibilityStateChange = (visible: boolean) => {
      setIsVisible(visible);
    };

    handleVisibilityStateChange(getCurrentVisibilityState());
    return onVisibilityStateChange(handleVisibilityStateChange);
  }, []);

  return {
    canFetch: isFocused && isVisible,
    isFocused,
    isVisible,
  };
}
