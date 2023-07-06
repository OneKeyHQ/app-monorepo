import { useCallback, useEffect, useState } from 'react';

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

  const onChange = useCallback(
    (state: 'active' | 'background' | 'blur') => {
      if (state === 'active') {
        onFocus();
      } else {
        onBlur();
      }
    },
    [onFocus, onBlur],
  );

  useEffect(() => {
    let remove: () => void;
    if (platformEnv.isDesktop) {
      remove = window.desktopApi.onAppState(onChange);
    }
    return () => {
      remove?.();
    };
  }, [onChange]);

  useFocusEffect(
    useCallback(() => {
      onFocus();

      if (platformEnv.isRuntimeBrowser && !platformEnv.isDesktop) {
        document.addEventListener('visibilitychange', visibilityStateListener);
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
      }

      return () => {
        onBlur();
        if (platformEnv.isRuntimeBrowser && !platformEnv.isDesktop) {
          document.removeEventListener(
            'visibilitychange',
            visibilityStateListener,
          );
          window.removeEventListener('blur', onBlur);
          window.removeEventListener('focus', onFocus);
        }
      };
    }, [visibilityStateListener, onBlur, onFocus]),
  );

  return isFocused;
};
