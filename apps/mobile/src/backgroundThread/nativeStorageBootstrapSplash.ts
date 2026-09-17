import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen';
import { Platform } from 'react-native';

interface ILegacyAndroidSplashScreen {
  hideAsync(): Promise<void>;
  preventAutoHideAsync(): Promise<boolean>;
}

function getLegacyAndroidSplashScreen():
  | ILegacyAndroidSplashScreen
  | undefined {
  if (Platform.OS !== 'android') {
    return undefined;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@onekeyfe/react-native-splash-screen')
    .ReactNativeSplashScreen as ILegacyAndroidSplashScreen;
}

function ignoreSplashPromise(promise: Promise<unknown> | undefined) {
  void promise?.catch(() => undefined);
}

export function preventNativeStorageBootstrapSplashAutoHide() {
  (
    globalThis as typeof globalThis & {
      __ONEKEY_SPLASH_AUTO_HIDE_PREVENTED__?: boolean;
    }
  ).__ONEKEY_SPLASH_AUTO_HIDE_PREVENTED__ = true;
  ignoreSplashPromise(preventAutoHideAsync());
  ignoreSplashPromise(getLegacyAndroidSplashScreen()?.preventAutoHideAsync());
}

export function hideNativeStorageBootstrapSplash() {
  ignoreSplashPromise(hideAsync());
  ignoreSplashPromise(getLegacyAndroidSplashScreen()?.hideAsync());
}
