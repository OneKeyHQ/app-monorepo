import 'core-js/es7/global';
import 'globalthis';
import browser from 'webextension-polyfill'; // or extensionizer

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// TODO move to polyfill file
if (platformEnv.isFirefox) {
  // @ts-ignore
  browser.$$isPolyfill = true;
  // @ts-ignore
  global.chromeLegacy = global.chrome;
  // @ts-ignore
  global.chrome = browser;
}
