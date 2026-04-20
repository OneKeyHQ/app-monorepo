/* eslint-disable import/order, import-js/order */
import '@onekeyhq/shared/src/performance/init';

import './jsReady';

import { I18nManager } from 'react-native';
import { registerRootComponent } from 'expo';

import '@onekeyhq/shared/src/polyfills';
// Kick the Android channel resolver at the earliest point so the
// sync classification + ANDROID_CHANNEL write-back happens before any
// downstream consumer (header builder, update guard) reads the value.
// The async Install Referrer probe runs off-thread and only feeds the
// native-logger diagnostic line.
import { resolveAndroidChannel } from '@onekeyhq/shared/src/androidNativeEnv';
import { initSentry } from '@onekeyhq/shared/src/modules3rdParty/sentry';

import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

import App from './App';

void resolveAndroidChannel();

ReactNativeDeviceUtils.initEventListeners();
initSentry();
I18nManager.allowRTL(true);

if (typeof globalThis.nativePerformanceNow === 'function') {
  globalThis.$$onekeyAppWillMountFromPerformanceNow =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    globalThis.nativePerformanceNow();
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      'onekeyAppWillMountFromPerformanceNow',
      (globalThis.$$onekeyAppWillMountFromPerformanceNow || 0) -
        (globalThis.$$onekeyJsReadyFromPerformanceNow || 0),
    );
  }
}
registerRootComponent(App);
