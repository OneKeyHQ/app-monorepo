// react-native-crypto
//      react-native-quick-crypto
// react-native-get-random-values
//      (react-native-crypto depend on) react-native-randombytes (deprecated)
console.log('================ cross-crypto (native)');

if (globalThis.crypto && globalThis.crypto.getRandomValues) {
  delete globalThis.crypto.getRandomValues;
}
// shim global.crypto.getRandomValues
require('react-native-get-random-values');

if (process.env.NODE_ENV !== 'production') {
  const getRandomValuesOld = globalThis.crypto.getRandomValues;
  globalThis.crypto.getRandomValues = function (...args) {
    console.log(
      '------------ call global.crypto.getRandomValues (native)',
      getRandomValuesOld,
    );
    return getRandomValuesOld.apply(globalThis.crypto, args);
  };
}

const crypto = require('react-native-crypto');

const { randomBytes } = require('@noble/hashes/utils');

// re-assign randomBytes from global.crypto.getRandomValues
crypto.randomBytes = randomBytes;
crypto.getRandomValues =
  crypto.getRandomValues || globalThis.crypto.getRandomValues;
globalThis.crypto.randomBytes =
  globalThis.crypto.randomBytes || crypto.randomBytes;

crypto.$$isOneKeyShim = true;
globalThis.crypto.$$isOneKeyShim = true;

if (process.env.NODE_ENV !== 'production') {
  console.log('react-native-crypto polyfilled', crypto, globalThis.crypto);
}

module.exports = crypto;
