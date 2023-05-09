/* eslint-disable @typescript-eslint/no-unsafe-member-access, import/order, @typescript-eslint/no-unsafe-call */
import platformEnv from '../platformEnv';

if (platformEnv.isExtension) {
  require('./polyfillsPlatform.ext');
} else if (platformEnv.isNative) {
  require('./polyfillsPlatform.native');
} else {
  // auto select platform extension file not working, so we use explicit require here
  require('./polyfillsPlatform');
}

const { normalizeRequestLibs } = require('../request/normalize');
const timerUtils = require('../utils/timerUtils').default;

normalizeRequestLibs();
timerUtils.interceptTimerWithDisable();
