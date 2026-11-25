import { useEffect, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// A visible Electron window still shows market data when another app has focus.
function getMarketVisibility() {
  return platformEnv.isDesktop && typeof document !== 'undefined'
    ? !document.hidden
    : getCurrentVisibilityState();
}

export function usePerpMarketForeground() {
  const isFocused = useIsFocused();
  const [visible, setVisible] = useState(getMarketVisibility);
  useEffect(() => {
    if (platformEnv.isDesktop && typeof document !== 'undefined') {
      const onChange = () => setVisible(!document.hidden);
      document.addEventListener('visibilitychange', onChange);
      onChange();
      return () => document.removeEventListener('visibilitychange', onChange);
    }
    return onVisibilityStateChange(setVisible);
  }, []);
  return isFocused && visible;
}
