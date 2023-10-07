const crypto = require('crypto-browserify');

const nativeCrypto = global.crypto;
if (nativeCrypto) {
  nativeCrypto.randomBytes = nativeCrypto.randomBytes || crypto.randomBytes;
  crypto.getRandomValues =
    crypto.getRandomValues || nativeCrypto.getRandomValues;
}
crypto.$$isOneKeyShim = true;
nativeCrypto.$$isOneKeyShim = true;

if (process.env.NODE_ENV !== 'production') {
  console.log('crypto-browserify polyfilled', crypto, nativeCrypto);
}

module.exports = crypto;
