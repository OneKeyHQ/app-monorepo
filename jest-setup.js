require('react-native-reanimated/lib/commonjs/reanimated2/jestUtils').setUpTests();

class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }
}

global.localStorage = new LocalStorageMock();
global.fetch = require('node-fetch');

// ** shim TextEncoder
// const { TextEncoder, TextDecoder } = require('util');
// global.TextEncoder = TextEncoder;
// global.TextDecoder = TextDecoder;

// ** shim App variables
// require('./packages/app/shim');

// ** Array, Buffer, Error
// https://github.com/facebook/jest/issues/2549

// ** asm.js support
// Linking failure in asm.js: Unexpected stdlib member

// ** await import() support
// Error: You need to run with a version of node that supports ES Modules in the VM API. See https://jestjs.io/docs/ecmascript-modules
