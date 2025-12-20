/* eslint-disable no-undef */
/* eslint-disable unicorn/prefer-global-this */
console.log('================ cross-crypto (web)');

if (process.env.NODE_ENV !== 'production') {
  const getRandomValuesOld = globalThis.crypto.getRandomValues;
  globalThis.crypto.getRandomValues = function (...args) {
    console.groupCollapsed(
      '------------ call global.crypto.getRandomValues (web)',
      getRandomValuesOld,
    );
    console.trace(getRandomValuesOld);
    console.groupEnd();
    return getRandomValuesOld.apply(global.crypto, args);
  };
}

const crypto = require('crypto-browserify');

if (globalThis.crypto) {
  globalThis.crypto.randomBytes =
    globalThis.crypto.randomBytes || crypto.randomBytes;
  crypto.getRandomValues =
    crypto.getRandomValues || globalThis.crypto.getRandomValues;
}
crypto.$$isOneKeyShim = true;
globalThis.crypto.$$isOneKeyShim = true;

if (process.env.NODE_ENV !== 'production') {
  console.log('crypto-browserify polyfilled', crypto, globalThis.crypto);
}

module.exports = crypto;
