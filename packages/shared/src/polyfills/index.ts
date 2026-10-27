/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */
// Start timing before the first dependency while guarding unpatched hosts.
if (
  process.env.NODE_ENV !== 'production' &&
  typeof globalThis !== 'undefined' &&
  typeof performance !== 'undefined'
) {
  const runtimeScope = globalThis as typeof globalThis & {
    $$debugT0?: number;
  };
  runtimeScope.$$debugT0 = runtimeScope.$$debugT0 ?? performance.now();
}

// Runtime primitives must precede adapters and third-party modules.
require('./polyfillsPlatform');
require('./walletConnectCompact');
require('./reactCreateElementShim');

require('../modules3rdParty/cross-crypto/verify');
require('../request');

const timerUtils = (
  require('../utils/timerUtils') as typeof import('../utils/timerUtils')
).default;
timerUtils.interceptTimerWithDisable();
