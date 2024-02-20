// require('react-native-reanimated').setUpTests();

// FIX:     ReferenceError: self is not defined
global.self = global.self || global;

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
global.$$onekeyAppStorage = new LocalStorageMock();
global.addEventListener = jest.fn;
global.fetch = require('node-fetch');
global.WebSocket = require('isomorphic-ws');

if (typeof structuredClone === 'undefined') {
  global.structuredClone = require('@ungap/structured-clone').default;
}

jest.mock('react-native-zip-archive', () => ({
  zip: jest.fn(),
}));

jest.mock('react-native-file-logger', () => ({
  FileLogger: {
    configure: jest.fn(),
    write: jest.fn(),
  },
  LogLevel: {
    Debug: 0,
    Info: 1,
    Warning: 2,
    Error: 3,
  },
}));

jest.mock('react-native-device-info', () => ({
  getBuildNumber: jest.fn(),
  getDeviceId: jest.fn(),
  getIncrementalSync: jest.fn(),
  getModel: jest.fn(),
  getSystemName: jest.fn(),
  getSystemVersion: jest.fn(),
  getTotalMemorySync: jest.fn(),
  getUsedMemorySync: jest.fn(),
}));

jest.mock('expo-localization', () => ({
  locale: '',
}));

// ** shim TextEncoder
// const { TextEncoder, TextDecoder } = require('util');
// global.TextEncoder = TextEncoder;
// global.TextDecoder = TextDecoder;

// ** shim App variables
// require('./apps/shim');

// ** Array, Buffer, Error
// https://github.com/facebook/jest/issues/2549

// ** asm.js support
// Linking failure in asm.js: Unexpected stdlib member

// ** await import() support
// Error: You need to run with a version of node that supports ES Modules in the VM API. See https://jestjs.io/docs/ecmascript-modules
