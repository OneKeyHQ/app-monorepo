import { useEffect } from 'react';

import { AppState } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const getCurrentVisibilityState = () => {
  if (platformEnv.isNative) {
    // currentState will be null at launch while AppState retrieves it over the bridge.
    // https://reactnative.dev/docs/appstate
    return AppState.currentState === 'active' || AppState.currentState === null;
  }
  return document.visibilityState === 'visible';
};
export const onVisibilityStateChange = (
  callback: (visible: boolean) => void,
) => {
  if (platformEnv.isNative) {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      callback(nextAppState === 'active');
    });
    return () => {
      subscription.remove();
    };
  }
  const handleVisibilityStateChange = () => {
    callback(document.visibilityState === 'visible');
  };
  const windowFocus = () => {
    callback(true);
  };
  const windowBlur = () => {
    callback(false);
  };
  document.addEventListener(
    'visibilitychange',
    handleVisibilityStateChange,
    false,
  );
  window.addEventListener('focus', windowFocus);
  window.addEventListener('blur', windowBlur);
  return () => {
    document.removeEventListener(
      'visibilitychange',
      handleVisibilityStateChange,
      false,
    );
    window.removeEventListener('focus', windowFocus);
    window.removeEventListener('blur', windowBlur);
  };
};

export const useVisibilityChange = (onChange: (visible: boolean) => void) => {
  useEffect(() => {
    const removeSubscription = onVisibilityStateChange(onChange);
    return removeSubscription;
  }, [onChange]);
};
