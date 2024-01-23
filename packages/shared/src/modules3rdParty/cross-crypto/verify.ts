import assert from 'assert';
import * as crypto from 'crypto';

const globalCrypto = global.crypto;

// @ts-ignore
assert.ok(globalCrypto?.$$isOneKeyShim, 'global crypto is not polyfilled');
// @ts-ignore
assert.ok(crypto?.$$isOneKeyShim, 'crypto is not polyfilled');

assert.equal(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  globalCrypto.getRandomValues,
  // @ts-ignore
  crypto.getRandomValues,
  'getRandomValues is not matched',
);

assert.equal(
  // @ts-ignore
  globalCrypto.randomBytes,
  crypto.randomBytes,
  'randomBytes is not matched',
);

if (process.env.NODE_ENV !== 'production') {
  console.log('cross-crypto verify success!');
}
