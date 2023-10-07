const crypto = require('crypto-browserify');

// **** for test only
// if (process.env.NODE_ENV !== 'production') {
//   const getRandomValuesOld = global.crypto.getRandomValues;
//   global.crypto.getRandomValues = function (...args) {
//     return getRandomValuesOld.apply(global.crypto, args);
//   };
// }

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
