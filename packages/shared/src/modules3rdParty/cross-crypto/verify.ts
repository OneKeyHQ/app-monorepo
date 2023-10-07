import assert from 'assert';
import * as crypto from 'crypto';

const nativeCrypto = global.crypto;

// @ts-ignore
assert.ok(nativeCrypto.$$isOneKeyShim, 'nativeCrypto is not polyfilled');
// @ts-ignore
assert.ok(crypto.$$isOneKeyShim, 'crypto is not polyfilled');

assert.equal(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  nativeCrypto.getRandomValues,
  // @ts-ignore
  crypto.getRandomValues,
  'getRandomValues is matched',
);

assert.equal(
  // @ts-ignore
  nativeCrypto.randomBytes,
  crypto.randomBytes,
  'randomBytes is matched',
);

if (process.env.NODE_ENV !== 'production') {
  console.log('cross-crypto verify success!');
}
