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

const { shim: shimArrayFlatMap } = require('array.prototype.flatmap');

shimArrayFlatMap();

if (typeof Array.prototype.toSorted !== 'function') {
  Object.defineProperty(Array.prototype, 'toSorted', {
    value(compareFn) {
      if (this == null) {
        throw new TypeError(
          'Array.prototype.toSorted called on null or undefined',
        );
      }
      return Array.prototype.slice.call(this).sort(compareFn);
    },
    configurable: true,
    writable: true,
  });
}

const { shim: shimArrayToReversed } = require('array.prototype.toreversed');

shimArrayToReversed();
