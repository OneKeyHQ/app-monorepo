/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */
// import { clearIntervalAsync, setIntervalAsync } from 'set-interval-async';

// Capture the startup baseline inside the first imported module so installing
// synchronous polyfills remains part of cold-start measurements.
if (process.env.NODE_ENV !== 'production') {
  const runtimeScope = globalThis as typeof globalThis & {
    $$debugT0?: number;
  };
  runtimeScope.$$debugT0 = runtimeScope.$$debugT0 ?? performance.now();
}

// Runtime primitives must be installed before compatibility adapters import
// third-party modules that may execute against those globals at module scope.
require('./polyfillsPlatform');
require('./walletConnectCompact');
require('./reactCreateElementShim');

require('../modules3rdParty/cross-crypto/verify');
require('../request');

// import { normalizeRequestLibs } from '../request/normalize';
const timerUtils = (
  require('../utils/timerUtils') as typeof import('../utils/timerUtils')
).default;
// @ts-ignore
// global.setInterval = setIntervalAsync;
// // @ts-ignore
// global.clearInterval = clearIntervalAsync;
// import { interceptConsoleErrorWithExtraInfo } from '../errors/utils/errorUtils';

// normalizeRequestLibs();
timerUtils.interceptTimerWithDisable();
const { markRuntimePolyfillsReady } =
  require('./runtimeCapabilities') as typeof import('./runtimeCapabilities');
markRuntimePolyfillsReady();
// interceptConsoleErrorWithExtraInfo();
