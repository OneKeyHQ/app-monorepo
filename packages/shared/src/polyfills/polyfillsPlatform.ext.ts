/* eslint-disable import/order */
import 'core-js/es7/global';
import 'setimmediate';
import 'globalthis';
import browser from 'webextension-polyfill'; // or extensionizer
import './xhrShim';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

/*
requestAnimationFrame is missing in mv3 background:
  ReferenceError: requestAnimationFrame is not defined
 */
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = setImmediate;
}

// TODO move to polyfill file
if (platformEnv.isRuntimeFirefox) {
  // @ts-ignore
  browser.$$isPolyfill = true;
  // @ts-ignore
  globalThis.chromeLegacy = globalThis.chrome;
  // @ts-ignore
  globalThis.chrome = browser;
} else {
  globalThis.browser = globalThis.browser || browser;
}

console.log('polyfillsPlatform.ext shim loaded');
