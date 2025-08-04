import { useCallback, useEffect } from 'react';

import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen';
import { NativeModules } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ISplashViewProps } from './type';

// Support for displaying splash screen on Android versions below 12
// This legacy splash screen implementation ensures compatibility with older Android devices
// that don't support the newer native splash screen APIs
const { LegacySplashScreen } = NativeModules as {
  LegacySplashScreen: {
    preventAutoHideAsync: () => Promise<boolean>;
    hideAsync: () => Promise<boolean>;
  };
};

void preventAutoHideAsync();
if (platformEnv.isNativeAndroid && LegacySplashScreen) {
  void LegacySplashScreen.preventAutoHideAsync();
}

export function SplashView({ onExit, ready }: ISplashViewProps) {
  const hideSplash = useCallback(() => {
    void hideAsync();
    if (platformEnv.isNativeAndroid && LegacySplashScreen) {
      void LegacySplashScreen.hideAsync();
    }
    onExit?.();
  }, [onExit]);

  useEffect(() => {
    void ready.then(() => {
      hideSplash();
    });
  }, [hideSplash, ready]);
  return null;
}
