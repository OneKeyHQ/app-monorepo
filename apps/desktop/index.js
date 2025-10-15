/* eslint-disable import/first */
/* eslint-disable unicorn/prefer-global-this */
if (typeof window !== 'undefined') {
  window.$$onekeyJsReadyAt = Date.now();
  if (typeof window.nativePerformanceNow === 'function') {
    window.$$onekeyJsReadyFromPerformanceNow = window.nativePerformanceNow();
  }
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
