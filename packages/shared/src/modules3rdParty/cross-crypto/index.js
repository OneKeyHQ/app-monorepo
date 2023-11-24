console.log('================ cross-crypto (web)');

if (process.env.NODE_ENV !== 'production') {
  const getRandomValuesOld = global.crypto.getRandomValues;
  global.crypto.getRandomValues = function (...args) {
    console.log(
      '------------ call global.crypto.getRandomValues (web)',
      getRandomValuesOld,
    );
    return getRandomValuesOld.apply(global.crypto, args);
  };
}

const crypto = require('crypto-browserify');

if (global.crypto) {
  global.crypto.randomBytes = global.crypto.randomBytes || crypto.randomBytes;
  crypto.getRandomValues =
    crypto.getRandomValues || global.crypto.getRandomValues;
}
crypto.$$isOneKeyShim = true;
global.crypto.$$isOneKeyShim = true;

if (process.env.NODE_ENV !== 'production') {
  console.log('crypto-browserify polyfilled', crypto, global.crypto);
}

module.exports = crypto;
