// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
/* oxlint-disable import-js/order */
// check  polyfillsPlatform.ext.ts  or   polyfillsPlatform.native.js
import './setimmediateShim';
import './requestIdleCallbackShim';
import './globalShim';
import './indexedDBShim/indexedDBShim';

if (process.env.NODE_ENV !== 'production') {
  global.$RefreshReg$ = global.$RefreshReg$ ?? (() => {});
  global.$RefreshSig$ = global.$RefreshSig$ ?? (() => (type) => type);
}

require('./webIntrinsics');

if (typeof globalThis.queueMicrotask !== 'function') {
  const resolvedPromise = Promise.resolve();
  Object.defineProperty(globalThis, 'queueMicrotask', {
    configurable: true,
    value(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('queueMicrotask requires a function');
      }
      resolvedPromise.then(callback).catch((error) => {
        setTimeout(() => {
          throw error;
        }, 0);
      });
    },
    writable: true,
  });
}

if (
  typeof globalThis.crypto?.getRandomValues === 'function' &&
  typeof globalThis.crypto.randomUUID !== 'function'
) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value() {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0'),
      );
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
        .slice(6, 8)
        .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
    },
    writable: true,
  });
}
