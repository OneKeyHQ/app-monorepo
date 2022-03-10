/* eslint-disable import/order */
import 'core-js/es7/global';
import 'globalthis';
import browser from 'webextension-polyfill'; // or extensionizer
import axios from 'axios';
// @ts-ignore
import axiosAdapter from '@vespaiach/axios-fetch-adapter';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

if (platformEnv.isExtensionBackgroundServiceWorker) {
  axios.defaults.adapter = axiosAdapter;
}

// TODO move to polyfill file
if (platformEnv.isFirefox) {
  // @ts-ignore
  browser.$$isPolyfill = true;
  // @ts-ignore
  global.chromeLegacy = global.chrome;
  // @ts-ignore
  global.chrome = browser;
} else {
  global.browser = global.browser || browser;
}
