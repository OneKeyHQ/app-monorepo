/* eslint-disable import/first */
/* eslint-disable unicorn/prefer-global-this */
if (typeof window !== 'undefined') {
  window.$$onekeyJsReadyAt = Date.now();
}

import { registerRootComponent } from 'expo';

import { initReactScan } from '@onekeyhq/shared/src/modules3rdParty/react-scan';
import App from './App';

initReactScan();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
