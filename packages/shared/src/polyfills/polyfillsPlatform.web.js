// oxlint-disable unicorn/prefer-global-this
// check  polyfillsPlatform.ext.ts  or   polyfillsPlatform.native.js
import './setimmediateShim';
import './globalShim';
import './indexedDBShim/indexedDBShim';

if (process.env.NODE_ENV !== 'production') {
  global.$RefreshReg$ = global.$RefreshReg$ ?? (() => {});
  global.$RefreshSig$ = global.$RefreshSig$ ?? (() => (type) => type);
}

const { shim: shimArrayFlatMap } = require('array.prototype.flatmap');

shimArrayFlatMap();

const { shim: shimArrayToSorted } = require('array.prototype.tosorted');

shimArrayToSorted();
