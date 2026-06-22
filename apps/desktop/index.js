// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable import/first */
/* oxlint-disable import-js/order */
import '@onekeyhq/shared/src/performance/init';

if (typeof window !== 'undefined') {
  window.$$onekeyJsReadyAt = Date.now();
}

import '@onekeyhq/shared/src/polyfills';

// Cold-start hydration: fires IndexedDB read promise + populates globalThis
// vars before React mounts. Must run after polyfills, before any jotai
// atoms are referenced. See packages/kit/src/components/GlobalJotaiReady
// which awaits the cold-start gate on web/desktop.
import '@onekeyhq/kit-bg/src/hydration/hydrate';

// Initialize desktop bridge before runtime hardening, then keep all application
// imports behind the hardened runtime.
import '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApiProxy';
import '@onekeyhq/shared/src/security/sesHarden/installDesktopRenderer';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
