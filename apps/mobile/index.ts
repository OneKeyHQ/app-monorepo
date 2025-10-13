/* eslint-disable import/order */
import './jsReady';

import { I18nManager } from 'react-native';
import { registerRootComponent } from 'expo';
import '@onekeyhq/shared/src/polyfills';
import { initSentry } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import App from './App';

initSentry();

I18nManager.allowRTL(true);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
if (typeof globalThis.nativePerformanceNow === 'function') {
  globalThis.$$onekeyAppWillMountFromPerformanceNow =
    globalThis.nativePerformanceNow();
  if (__DEV__) {
    console.log(
      'onekeyAppWillMountFromPerformanceNow',
      (globalThis.$$onekeyAppWillMountFromPerformanceNow || 0) -
        (globalThis.$$onekeyJsReadyFromPerformanceNow || 0),
    );
  }
}
registerRootComponent(App);
