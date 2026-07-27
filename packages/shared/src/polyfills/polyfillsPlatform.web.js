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

if (typeof Array.prototype.at !== 'function') {
  Object.defineProperty(Array.prototype, 'at', {
    configurable: true,
    value(index) {
      const length = this.length >>> 0;
      const numericIndex = Number(index);
      if (!Number.isFinite(numericIndex)) {
        return undefined;
      }
      const integerIndex = Math.trunc(numericIndex);
      const relativeIndex =
        integerIndex < 0 ? length + integerIndex : integerIndex;
      return relativeIndex >= 0 && relativeIndex < length
        ? this[relativeIndex]
        : undefined;
    },
    writable: true,
  });
}

if (typeof String.prototype.replaceAll !== 'function') {
  Object.defineProperty(String.prototype, 'replaceAll', {
    configurable: true,
    value(searchValue, replacement) {
      const value = String(this);
      if (searchValue instanceof RegExp) {
        if (!searchValue.global) {
          throw new TypeError(
            'replaceAll requires a global regular expression',
          );
        }
        return value.replace(searchValue, replacement);
      }
      const escapedSearchValue = String(searchValue).replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      return value.replace(new RegExp(escapedSearchValue, 'g'), replacement);
    },
    writable: true,
  });
}

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

if (typeof Promise.allSettled !== 'function') {
  Object.defineProperty(Promise, 'allSettled', {
    configurable: true,
    value(iterable) {
      return Promise.all(
        Array.from(iterable, (item) =>
          Promise.resolve(item).then(
            (value) => ({ status: 'fulfilled', value }),
            (reason) => ({ status: 'rejected', reason }),
          ),
        ),
      );
    },
    writable: true,
  });
}

if (typeof Object.fromEntries !== 'function') {
  Object.defineProperty(Object, 'fromEntries', {
    configurable: true,
    value(iterable) {
      const result = {};
      Array.from(iterable).forEach(([key, value]) => {
        Object.defineProperty(result, key, {
          configurable: true,
          enumerable: true,
          value,
          writable: true,
        });
      });
      return result;
    },
    writable: true,
  });
}

if (typeof Array.prototype.toSorted !== 'function') {
  Object.defineProperty(Array.prototype, 'toSorted', {
    value(compareFn) {
      if (this === null || this === undefined) {
        throw new TypeError(
          'Array.prototype.toSorted called on null or undefined',
        );
      }
      const items = Array.prototype.slice.call(this);
      return Reflect.apply(Array.prototype.sort, items, [compareFn]);
    },
    configurable: true,
    writable: true,
  });
}

const { shim: shimArrayToReversed } = require('array.prototype.toreversed');

shimArrayToReversed();
