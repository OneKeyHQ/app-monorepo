import { useCallback, useEffect } from 'react';

import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ISplashViewProps } from './type';

interface IReactNativeSplashScreen {
  preventAutoHideAsync(): Promise<void>;
  hideAsync(): Promise<void>;
}

let _legacyAndroidSplash: IReactNativeSplashScreen | null = null;
function getLegacyAndroidSplash(): IReactNativeSplashScreen {
  if (!_legacyAndroidSplash) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@onekeyfe/react-native-splash-screen');
    _legacyAndroidSplash = mod.ReactNativeSplashScreen;
  }
  return _legacyAndroidSplash!;
}

// Support for displaying splash screen on Android versions below 12
// This legacy splash screen implementation ensures compatibility with older Android devices
// that don't support the newer native splash screen APIs
void preventAutoHideAsync();
if (platformEnv.isNativeAndroid) {
  void getLegacyAndroidSplash().preventAutoHideAsync();
}

const jsEntryStart: number =
  (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || Date.now();

export function SplashView({ onExit, canDismissSplash }: ISplashViewProps) {
  const hideSplash = useCallback(() => {
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const elapsed = Date.now() - jsEntryStart;
      defaultLogger.app.appUpdate.log(
        `[SplashView] hideSplash invoked at +${elapsed}ms from JS entry, dismissing native splash`,
      );
    }
    void hideAsync().catch((error) => {
      defaultLogger.app.appUpdate.log(
        `[SplashView] hideAsync failed: ${(error as Error)?.message ?? 'unknown'}`,
      );
    });
    if (platformEnv.isNativeAndroid) {
      void getLegacyAndroidSplash().hideAsync();
    }
    onExit?.();
  }, [onExit]);

  useEffect(() => {
    if (!canDismissSplash) {
      return;
    }
    // No setTimeout — the React commit that will render the post-splash tree
    // already completed before this effect runs. The previous setTimeout(50)
    // here was observed to get starved to ~320ms under main-thread load, which
    // was the single largest delay in the "SplashProvider mount → hideSplash"
    // window.
    hideSplash();
  }, [canDismissSplash, hideSplash]);
  return null;
}
