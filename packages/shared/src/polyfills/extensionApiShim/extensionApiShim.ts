// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
import browser from 'webextension-polyfill'; // or extensionizer

import platformEnv from '../../platformEnv';

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
