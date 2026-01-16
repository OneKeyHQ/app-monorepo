/* eslint-disable import/first */
/* eslint-disable unicorn/prefer-global-this */
import '@onekeyhq/shared/src/performance/init';

if (typeof window !== 'undefined') {
  window.$$onekeyJsReadyAt = Date.now();
}

import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
