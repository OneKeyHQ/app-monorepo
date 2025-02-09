import assert from 'assert';
import * as nodeCrypto from 'crypto';

import appGlobals from '../../appGlobals';

const globalCrypto = globalThis.crypto;

// @ts-ignore
assert.ok(globalCrypto?.$$isOneKeyShim, 'global.crypto is not polyfilled');
// @ts-ignore
assert.ok(nodeCrypto?.$$isOneKeyShim, 'node crypto is not polyfilled');

assert.equal(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  globalCrypto.getRandomValues,
  // @ts-ignore
  nodeCrypto.getRandomValues,
  'crypto.getRandomValues is not matched',
);

assert.equal(
  // @ts-ignore
  globalCrypto.randomBytes,
  nodeCrypto.randomBytes,
  'crypto.randomBytes is not matched',
);

// assert.equal('1', '2', 'cross-crypto verify test : 1 is not equal to 2');

appGlobals.$$cryptoGlobal = globalCrypto;
appGlobals.$$cryptoNode = nodeCrypto;

if (process.env.NODE_ENV !== 'production') {
  console.log('cross-crypto verify success!');
}
