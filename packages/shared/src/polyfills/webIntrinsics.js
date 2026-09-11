// Shared by normal web bootstrap and the LavaMoat pre-harden static shim.
// Keep host APIs (DOM, storage, timers, crypto) out of this entry.
// Existing methods must not be shimmed again after SES freezes unscopables.
if (typeof Array.prototype.flatMap !== 'function') {
  const { shim: shimArrayFlatMap } = require('array.prototype.flatmap');
  shimArrayFlatMap();
}

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

if (typeof Array.prototype.toReversed !== 'function') {
  const { shim: shimArrayToReversed } = require('array.prototype.toreversed');
  shimArrayToReversed();
}
