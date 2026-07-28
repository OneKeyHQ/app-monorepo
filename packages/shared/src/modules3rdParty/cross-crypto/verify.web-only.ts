import appGlobals from '../../appGlobals';

const globalCrypto = globalThis.crypto;

if (process.env.NODE_ENV !== 'production' && !globalCrypto?.getRandomValues) {
  console.warn('globalThis.crypto.getRandomValues is not available');
}

appGlobals.$$cryptoGlobal = globalCrypto;
appGlobals.$$cryptoNode = undefined;

if (process.env.NODE_ENV !== 'production') {
  console.log('cross-crypto web native verify success');
}
