import { useCallback, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useVisibilityFocused = () => {
  const [isFocused, setIsFocused] = useState(false);

  const onBlur = useCallback(() => setIsFocused(false), []);
  const onFocus = useCallback(() => setIsFocused(true), []);

  const visibilityStateListener = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      onBlur();
    }
    if (document.visibilityState === 'visible') {
      onFocus();
    }
  }, [onFocus, onBlur]);

  useFocusEffect(
    useCallback(() => {
      onFocus();

      if (platformEnv.isRuntimeBrowser) {
        document.addEventListener('visibilitychange', visibilityStateListener);
        if (!platformEnv.isDesktop) {
          window.addEventListener('blur', onBlur);
          window.addEventListener('focus', onFocus);
        }
      }

      return () => {
        onBlur();
        if (platformEnv.isRuntimeBrowser) {
          document.removeEventListener(
            'visibilitychange',
            visibilityStateListener,
          );
          if (!platformEnv.isDesktop) {
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', onFocus);
          }
        }
      };
    }, [visibilityStateListener, onBlur, onFocus]),
  );

  return isFocused;
};
