/* eslint-disable import/order */
import 'core-js/es7/global';
import 'globalthis';
import browser from 'webextension-polyfill'; // or extensionizer
import './xhrShim';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

/*
requestAnimationFrame is missing in mv3 background:
  ReferenceError: requestAnimationFrame is not defined
 */
if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = setImmediate;
}

// TODO move to polyfill file
if (platformEnv.isRuntimeFirefox) {
  // @ts-ignore
  browser.$$isPolyfill = true;
  // @ts-ignore
  global.chromeLegacy = global.chrome;
  // @ts-ignore
  global.chrome = browser;
} else {
  global.browser = global.browser || browser;
}

console.log('polyfillsPlatform.ext shim loaded');
