// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
let globalObject;
if (typeof globalThis !== 'undefined') {
  globalObject = globalThis;
} else if (typeof self !== 'undefined') {
  globalObject = self;
} else {
  globalObject = window;
}

// Chromium 67 predates globalThis, but web-embed code uses it as the shared
// browser global. Install it before any application module is evaluated.
if (typeof globalThis === 'undefined') {
  Object.defineProperty(globalObject, 'globalThis', {
    configurable: true,
    value: globalObject,
    writable: true,
  });
}

// global is not defined
// https://github.com/mrousavy/react-native-mmkv/issues/794
if (typeof globalObject.global === 'undefined') {
  globalObject.global = globalObject;
}
