/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable no-undef */
// react-native-crypto
//      react-native-quick-crypto
// react-native-get-random-values
console.log('================ cross-crypto (native)');

// delete globalThis.crypto.getRandomValues first
// make sure react-native-get-random-values can be shimmed
if (globalThis.crypto && globalThis.crypto.getRandomValues) {
  delete globalThis.crypto.getRandomValues;
}
// shim global.crypto.getRandomValues
// node_modules/react-native-get-random-values/index.js
require('react-native-get-random-values');

if (process.env.NODE_ENV !== 'production') {
  const getRandomValuesOld = globalThis.crypto.getRandomValues;
  globalThis.crypto.getRandomValues = function (...args) {
    // - sentry component uuid
    // - encodeSensitiveText
    console.log(
      '-------- call global.crypto.getRandomValues (native)',
      getRandomValuesOld,
    );
    // console.trace('global.crypto.getRandomValues (native)');
    return getRandomValuesOld.apply(globalThis.crypto, args);
  };
}

const crypto = require('react-native-crypto');

const { randomBytes } = require('@noble/hashes/utils');
const uuid = require('react-native-uuid');

// TODO polyfill randomUUID may cause RevenueCat not ready
// const randomUUID = () => {
//   const result = uuid.v4();
//   console.log('randomUUID', result);
//   return result;
// };
const randomUUID = undefined;

// re-assign randomBytes from global.crypto.getRandomValues
crypto.randomBytes = randomBytes;
crypto.randomUUID = crypto.randomUUID || randomUUID;
crypto.getRandomValues =
  crypto.getRandomValues || globalThis.crypto.getRandomValues;
globalThis.crypto.randomBytes =
  globalThis.crypto.randomBytes || crypto.randomBytes;
globalThis.crypto.randomUUID =
  globalThis.crypto.randomUUID || crypto.randomUUID;

crypto.$$isOneKeyShim = true;
globalThis.crypto.$$isOneKeyShim = true;

if (process.env.NODE_ENV !== 'production') {
  console.log('react-native-crypto polyfilled', crypto, globalThis.crypto);
}

// re-assign crypto to global.crypto by packages/shared/src/polyfills/polyfillsPlatform.js
//      global.crypto = require('crypto')
module.exports = crypto;
